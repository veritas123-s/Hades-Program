import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Cloud,
  LayoutDashboard,
  ShieldCheck,
  X,
} from "lucide-react";

const STEPS = [
  {
    Icon: LayoutDashboard,
    title: "从今日开始",
    text: "首页汇总今天的课程、截止任务和下一步建议。新任务可直接进入清单与四象限。",
  },
  {
    Icon: CalendarDays,
    title: "安排时间",
    text: "日历把课程、任务和日程放在同一条时间线上；专注记录会形成可回看的工作轨迹。",
  },
  {
    Icon: Cloud,
    title: "连接手机与电脑",
    text: "登录同一个 Hades 账号并开启同步，安卓端和电脑端即可共享任务、日程与专注记录。",
  },
  {
    Icon: ShieldCheck,
    title: "你的数据由你掌控",
    text: "个人功能登录后才解锁。账号令牌加密保存，学校登录与模型密钥不进入云同步。",
  },
];

export default function OnboardingTour({ onFinish }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const escape = (event) => event.key === "Escape" && onFinish();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onFinish]);
  const item = STEPS[step];
  return (
    <div
      className="modal-backdrop onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Hades 新手教程"
    >
      <section className="onboarding-card">
        <button
          className="icon-button onboarding-close"
          aria-label="跳过教程"
          onClick={onFinish}
        >
          <X size={20} />
        </button>
        <div className="onboarding-art">
          <item.Icon size={42} strokeWidth={1.5} />
        </div>
        <p className="eyebrow">
          快速上手 · {step + 1}/{STEPS.length}
        </p>
        <h2>{item.title}</h2>
        <p>{item.text}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {STEPS.map((_, index) => (
            <i className={index === step ? "active" : ""} key={index} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="button" onClick={onFinish}>
            跳过
          </button>
          <button
            className="button primary"
            onClick={() =>
              step === STEPS.length - 1
                ? onFinish()
                : setStep((value) => value + 1)
            }
          >
            {step === STEPS.length - 1 ? "开始使用" : "下一步"}
          </button>
        </div>
      </section>
    </div>
  );
}
