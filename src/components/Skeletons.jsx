// Thẻ phim chờ: đúng khuôn MovieCard (poster 2:3 + 2 dòng tên) để lúc dữ liệu về trang không nhảy
export function PosterSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton aspect-[2/3] rounded-lg" />
      <div className="skeleton mt-2.5 h-3 w-4/5 rounded-full" />
      <div className="skeleton mt-1.5 h-3 w-1/2 rounded-full" />
    </div>
  );
}

// Hàng băng chuyền chờ: tiêu đề + một hàng poster cùng bề rộng với MovieCarousel
export function PosterRowSkeleton({ count = 8 }) {
  return (
    <section className="mx-auto w-full max-w-container-max px-4 sm:px-6" aria-hidden="true">
      <div className="skeleton mb-4 h-4 w-44 rounded-full" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[132px] shrink-0 sm:w-[156px] lg:w-[184px]">
            <PosterSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

// Lưới poster chờ (Kho phim): cùng số cột với lưới thật
export function PosterGridSkeleton({ count = 18 }) {
  return (
    <div aria-busy="true" className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => <PosterSkeleton key={i} />)}
      <span className="sr-only" role="status">Đang tải danh sách phim</span>
    </div>
  );
}

// Banner chờ ở trang chủ: đúng chiều cao banner thật
export function HeroSkeleton() {
  return (
    <section className="relative min-h-[62vh] w-full md:min-h-[78vh]" aria-hidden="true">
      <div className="skeleton absolute inset-0 rounded-none" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-container-max space-y-4 px-4 pb-14 sm:px-6 md:pb-20">
        <div className="skeleton h-9 w-2/3 max-w-md rounded-lg" />
        <div className="skeleton h-3 w-full max-w-xl rounded-full" />
        <div className="skeleton h-3 w-4/5 max-w-lg rounded-full" />
        <div className="flex gap-3 pt-2">
          <div className="skeleton h-11 w-32 rounded-xl" />
          <div className="skeleton h-11 w-32 rounded-xl" />
        </div>
      </div>
    </section>
  );
}

// Trang chi tiết chờ: poster + tên + nút + danh sách tập
export function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-container-max px-4 pb-20 pt-24 sm:px-6" aria-busy="true">
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="skeleton mx-auto aspect-[2/3] w-44 rounded-xl md:w-full" />
        <div className="space-y-4">
          <div className="skeleton h-8 w-2/3 rounded-lg" />
          <div className="skeleton h-3 w-1/3 rounded-full" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-6 w-16 rounded-md" />)}
          </div>
          <div className="skeleton h-12 w-44 rounded-xl" />
          <div className="space-y-2 pt-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-11/12 rounded-full" />
            <div className="skeleton h-3 w-3/4 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-2 pt-4 sm:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">Đang tải thông tin phim</span>
    </main>
  );
}
