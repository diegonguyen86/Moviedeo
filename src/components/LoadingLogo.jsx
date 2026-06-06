export default function LoadingLogo({ className = "w-12 h-12" }) {
  return (
    <div className="flex items-center justify-center flex-col">
      <img 
        src={`${import.meta.env.BASE_URL}icon.png`} 
        alt="Loading..." 
        className={`${className} animate-pulse object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.7)] hover:scale-110 transition-transform`}
      />
    </div>
  );
}
