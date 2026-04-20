import { Wrench } from "lucide-react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "#e0f2fe" }}
        >
          <Wrench className="w-8 h-8" style={{ color: "#0ea5e9" }} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          In costruzione
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">
          {description ??
            "Sezione in fase di rework per Molokai. Il codice legacy Anda è disponibile nella git history."}
        </p>
      </div>
    </div>
  );
}
