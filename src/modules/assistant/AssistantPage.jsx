import React from "react";
import {
  Sparkles,
  CalendarClock,
  ListChecks,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
export default function AssistantPage({ openAssistant, setPage, addTask }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">智能助手</p>
          <h1>从一句话，到井然有序</h1>
          <p>你选择的模型、任务清单与早晚报，在同一个工作台协作。</p>
        </div>
        <button className="button primary" onClick={openAssistant}>
          <Sparkles size={17} />
          开始对话
        </button>
      </div>
      <section className="panel assistant-intro">
        <div className="assistant-intro-copy">
          <Sparkles size={34} />
          <h2>把零散的想法，交给 Poseidon 整理。</h2>
          <p>
            说出要做的事，获得可编辑的任务卡片。核对后一起加入清单，四象限与早晚报自动使用同一份任务数据。
          </p>
          <button className="button primary" onClick={openAssistant}>
            打开侧边助手 <ArrowRight size={16} />
          </button>
        </div>
        <div className="assistant-steps">
          <div>
            <ListChecks />
            <strong>01 · 说出与确认</strong>
            <p>一次整理多项任务，自由修改日期、优先级、清单和步骤。</p>
          </div>
          <div>
            <CalendarClock />
            <strong>02 · 自动进入早晚报</strong>
            <p>
              未来3天到期、逾期及重要任务纳入早晚报预览。微信推送需另行配置自己的云端通道。
            </p>
          </div>
          <div>
            <ShieldCheck />
            <strong>03 · 自选模型，本机密钥</strong>
            <p>
              填写自己的 API 地址、密钥和模型名，支持兼容 OpenAI
              的接口。密钥加密保存，任务经你确认后加入。
            </p>
          </div>
        </div>
      </section>
      <div className="ai-landing-actions">
        <button className="button" onClick={addTask}>
          手动添加任务
        </button>
        <button className="button" onClick={() => setPage("briefing")}>
          查看早晚报与同步状态
        </button>
      </div>
    </>
  );
}
