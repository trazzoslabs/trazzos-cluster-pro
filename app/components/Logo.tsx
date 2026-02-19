export default function Logo() {
  return (
    <div className="flex flex-col">
      {/* Main "razzos" text */}
      <div className="flex items-center gap-2">
        {/* "razzos" text */}
        <span className="text-2xl text-white font-semibold tracking-tight relative inline-block">
          razzos
        </span>
      </div>
      
      {/* "cluster pro" subtitle */}
      <span className="text-xs text-zinc-400 font-medium tracking-wide mt-0.5 ml-8">
        cluster pro
      </span>
    </div>
  );
}

