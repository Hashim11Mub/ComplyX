import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type Props = {
  steps: string[];
  currentStep: number;
  done: boolean;
};

export default function AgentSteps({ steps, currentStep, done }: Props) {
  return (
    <section className="panel agent-panel" aria-label="خطوات الوكيل">
      <div className="section-title">
        <span>مسار الوكيل</span>
        <strong>{done ? "مكتمل" : "نشط"}</strong>
      </div>
      <div className="steps">
        {steps.map((step, index) => {
          const completed = done || index < currentStep;
          const active = !done && index === currentStep;
          return (
            <div className="step" key={step}>
              {completed ? <CheckCircle2 size={20} /> : active ? <Loader2 className="spin" size={20} /> : <Circle size={20} />}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

