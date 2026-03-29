import { CodeBlock } from "./code-block";

interface Step {
  title: string;
  file: string;
  code: string;
}

export function StepSection({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-8">
      {steps.map((step, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-950 text-cyan-400 text-sm font-bold border border-cyan-800">
              {i + 1}
            </span>
            <h3 className="text-lg font-semibold text-zinc-100">{step.title}</h3>
          </div>
          <CodeBlock code={step.code} file={step.file || undefined} />
        </div>
      ))}
    </div>
  );
}
