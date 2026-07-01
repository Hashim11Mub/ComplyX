import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type Props = {
  steps: string[];
  currentStep: number;
  done: boolean;
  lang?: "ar" | "en";
  variant?: "card" | "pipeline";
};

export default function AgentSteps({ steps, currentStep, done, lang = "ar", variant = "card" }: Props) {
  const title = lang === "ar" ? "مسار الوكيل" : "Agent path";
  const complete = lang === "ar" ? "مكتمل" : "Complete";
  const activeLabel = lang === "ar" ? "نشط" : "Active";

  if (variant === "pipeline") {
    return (
      <section className="agent-pipeline" aria-label={title}>
        {steps.map((step, index) => {
          const completed = done || index < currentStep;
          const active = !done && index === currentStep;
          return (
            <div className={completed ? "pipeline-step done" : active ? "pipeline-step active" : "pipeline-step"} key={step}>
              <div className="pipeline-node">
                {active && <span className="pulse-ring" />}
                {completed ? <CheckCircle2 size={20} /> : active ? <Loader2 className="spin" size={20} /> : <Circle size={20} />}
              </div>
              <span>{step}</span>
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section className="panel agent-panel" aria-label="خطوات الوكيل">
      <div className="section-title">
        <span>{title}</span>
        <strong>{done ? complete : activeLabel}</strong>
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
