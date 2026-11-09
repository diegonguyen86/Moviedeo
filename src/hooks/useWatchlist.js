import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ---------------------------------------------------------------------------
// KHO WATCHLIST DÙNG CHUNG (1 listener Firestore duy nhất cho cả app)
// Trước đây mỗi MovieCard gọi useWatchlist() lại tự mở 1 listener Firestore riêng
// -> trang chủ ~100 thẻ phim = ~100 listener, tốn quota & làm chậm máy.
// Ngoài ra listener cũ không bao giờ được huỷ khi đăng xuất / đổi tài khoản.
// ---------------------------------------------------------------------------

const storageKey = (uid) => (uid ? `moviedeo_watchlist_${uid}` : 'moviedeo_watchlist');

const readLocal = (uid) => {
  try {
    const saved = localStorage.getItem(storageKey(uid));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const writeLocal = (uid, list) => {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(list));
  } catch { /* LocalStorage đầy hoặc bị chặn */ }
};

let currentUid = auth.currentUser?.uid || null;
let watchlist = readLocal(currentUid);
const listeners = new Set();
let unsubSnap = null;
let started = false;

const emit = (list) => {
  watchlist = list;
  writeLocal(currentUid, list);
  listeners.forEach((l) => l());
};

const startSync = () => {
  if (started) return;
  started = true;
  onAuthStateChanged(auth, (user) => {
    if (unsubSnap) {
      unsubSnap();
      unsubSnap = null;
    }
    currentUid = user?.uid || null;
    watchlist = readLocal(currentUid);
    listeners.forEach((l) => l());

    if (!user) return;
    const q = query(collection(db, 'watchlists'), where('userId', '==', user.uid));
    unsubSnap = onSnapshot(q, (snapshot) => {
      const cloudList = snapshot.docs.map((d) => {
        const data = d.data();
        const safeSlug = data.id || data.slug || data.movieId || d.id.split('_').slice(1).join('_');
        return {
          ...data,
          id: safeSlug,
          slug: safeSlug,
          name: data.name || data.title || data.movieName || 'Phim',
          title: data.title || data.name || data.movieName || 'Phim',
          thumb_url: data.thumb_url || data.image || data.movieThumb || '',
          image: data.image || data.thumb_url || data.movieThumb || '',
          year: data.year || '',
          quality: data.quality || 'FHD',
          lang: data.lang || 'Vietsub',
        };
      });
      // Phim mới thêm lên đầu
      cloudList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      emit(cloudList);
    }, (err) => {
      console.error('Lỗi sync Firestore watchlist:', err);
    });
  });
};

const subscribe = (listener) => {
  startSync();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => watchlist;

const addToWatchlist = async (movie) => {
  const slug = movie.slug || movie.id;
  if (!slug) return;

  if (!watchlist.find((m) => (m.slug || m.id) === slug)) {
    emit([{ ...movie, slug, id: slug }, ...watchlist]);
  }

  if (auth.currentUser) {
    try {
      const docRef = doc(db, 'watchlists', `${auth.currentUser.uid}_${slug}`);
      await setDoc(docRef, {
        userId: auth.currentUser.uid,
        id: slug,
        slug,
        movieId: slug,
        title: movie.name || movie.title || '',
        name: movie.name || movie.title || '',
        image: movie.thumb_url || movie.image || '',
        thumb_url: movie.thumb_url || movie.image || '',
        year: movie.year || '',
        quality: movie.quality || 'FHD',
        lang: movie.lang || 'Vietsub',
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Lỗi lưu watchlist lên Firebase:', e);
    }
  }
};

const removeFromWatchlist = async (slug) => {
  if (!slug) return;
  emit(watchlist.filter((m) => (m.slug || m.id) !== slug));

  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, 'watchlists', `${auth.currentUser.uid}_${slug}`));
    } catch (e) {
      console.error('Lỗi xóa watchlist khỏi Firebase:', e);
    }
  }
};

const isSavedIn = (list, slug) => list.some((m) => (m.slug || m.id) === slug);

export const useWatchlist = () => {
  const list = useSyncExternalStore(subscribe, getSnapshot);
  return {
    watchlist: list,
    addToWatchlist,
    removeFromWatchlist,
    isSaved: (slug) => isSavedIn(list, slug),
  };
};
