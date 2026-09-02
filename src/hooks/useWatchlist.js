import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('moviedeo_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Real-time sync with Firebase Firestore if logged in
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "watchlists"), where("userId", "==", user.uid));
        const unsubSnap = onSnapshot(q, (snapshot) => {
          const cloudList = snapshot.docs.map(d => {
            const data = d.data();
            const safeSlug = data.id || data.slug || data.movieId || d.id.split('_').slice(1).join('_');
            return {
              id: safeSlug,
              slug: safeSlug,
              name: data.name || data.title || data.movieName || 'Phim',
              title: data.title || data.name || data.movieName || 'Phim',
              thumb_url: data.thumb_url || data.image || data.movieThumb || '',
              image: data.image || data.thumb_url || data.movieThumb || '',
              year: data.year || '2024',
              quality: data.quality || 'FHD',
              lang: data.lang || 'Vietsub',
              ...data
            };
          });
          setWatchlist(cloudList);
          try {
            localStorage.setItem('moviedeo_watchlist', JSON.stringify(cloudList));
          } catch (e) {}
        }, (err) => {
          console.error("Lỗi sync Firestore watchlist:", err);
        });

        return () => unsubSnap();
      } else {
        try {
          const saved = localStorage.getItem('moviedeo_watchlist');
          setWatchlist(saved ? JSON.parse(saved) : []);
        } catch (e) {
          setWatchlist([]);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const addToWatchlist = async (movie) => {
    const slug = movie.slug || movie.id;
    if (!slug) return;

    // 1. Optimistic update local
    setWatchlist(prev => {
      if (prev.find(m => (m.slug || m.id) === slug)) return prev;
      const updated = [{ ...movie, slug, id: slug }, ...prev];
      try {
        localStorage.setItem('moviedeo_watchlist', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2. Sync to Cloud Firestore if logged in
    if (auth.currentUser) {
      try {
        const docId = `${auth.currentUser.uid}_${slug}`;
        const docRef = doc(db, 'watchlists', docId);
        await setDoc(docRef, {
          userId: auth.currentUser.uid,
          id: slug,
          slug: slug,
          movieId: slug,
          title: movie.name || movie.title || '',
          name: movie.name || movie.title || '',
          image: movie.thumb_url || movie.image || '',
          thumb_url: movie.thumb_url || movie.image || '',
          year: movie.year || '2024',
          quality: movie.quality || 'FHD',
          lang: movie.lang || 'Vietsub',
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Lỗi lưu watchlist lên Firebase:", e);
      }
    }
  };

  const removeFromWatchlist = async (slug) => {
    if (!slug) return;

    // 1. Update local
    setWatchlist(prev => {
      const updated = prev.filter(m => (m.slug || m.id) !== slug);
      try {
        localStorage.setItem('moviedeo_watchlist', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2. Sync to Cloud Firestore if logged in
    if (auth.currentUser) {
      try {
        const docId = `${auth.currentUser.uid}_${slug}`;
        await deleteDoc(doc(db, 'watchlists', docId));
      } catch (e) {
        console.error("Lỗi xóa watchlist khỏi Firebase:", e);
      }
    }
  };

  const isSaved = (slug) => {
    return watchlist.some(m => (m.slug || m.id) === slug);
  };

  return { watchlist, addToWatchlist, removeFromWatchlist, isSaved };
};
