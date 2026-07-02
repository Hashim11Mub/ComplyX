"use client";

import { Check } from "lucide-react";
import { PIPELINE_STEPS } from "@/lib/mockCompliance";
import { Lang } from "@/lib/types";

type Props = {
  activeStep: number;
  doneFlags: boolean[];
  lang: Lang;
};

const T = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

export default function AgentSteps({ activeStep, doneFlags, lang }: Props) {
  return (
    <div className="cx-pipeline" aria-label={T(lang, "Agent analysis pipeline", "مسار تحليل الوكيل")}>
      <div className="cx-pipeline-list">
        {PIPELINE_STEPS.map((step, index) => {
          const done = doneFlags[index];
          const active = !done && activeStep === index;
          const pending = !done && !active;

          return (
            <div className={`cx-step-row${active ? " is-active" : ""}`} key={step.labelEn}>
              <div className="cx-step-node-col">
                <div className="cx-step-node-wrap">
                  {active && <div className="cx-pulse-ring" />}
                  <div className={`cx-step-node${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
                    {done && <Check size={18} strokeWidth={2.6} />}
                    {active && <span className="cx-spinner" />}
                    {pending && <span>{index + 1}</span>}
                  </div>
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div className="cx-connector" aria-hidden="true">
                    <div className={`cx-connector-fill${done ? " is-filled" : ""}`} />
                  </div>
                )}
              </div>
              <div className="cx-step-copy" style={{ paddingBottom: index < PIPELINE_STEPS.length - 1 ? 22 : 0 }}>
                <div className={`cx-step-label${active ? " is-current" : ""}${done ? " is-done" : ""}`}>
                  {T(lang, step.labelEn, step.labelAr)}
                </div>
                <div className="cx-step-sub">
                  {active ? T(lang, "Analyzing", "جار التحليل") : done ? T(lang, "Complete", "مكتمل") : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
