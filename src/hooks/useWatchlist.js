import { useState, useEffect } from 'react';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('moviedeo_watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('moviedeo_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (movie) => {
    setWatchlist(prev => {
      // Đảm bảo không lưu trùng
      if (prev.find(m => m.slug === movie.slug)) return prev;
      return [movie, ...prev];
    });
  };

  const removeFromWatchlist = (slug) => {
    setWatchlist(prev => prev.filter(m => m.slug !== slug));
  };

  const isSaved = (slug) => {
    return watchlist.some(m => m.slug === slug);
  };

  return { watchlist, addToWatchlist, removeFromWatchlist, isSaved };
};
