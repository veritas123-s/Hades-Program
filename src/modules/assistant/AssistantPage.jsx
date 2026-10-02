import Panel from "../../shared/Panel.jsx";
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
          <h1>Poseidon</h1>
        </div>
        <button className="button primary" onClick={openAssistant}>
          <Sparkles size={17} />
          开始对话
        </button>
      </div>
      <Panel className="panel assistant-intro">
        <div className="assistant-intro-copy">
          <Sparkles size={34} />
          <h2>任务与小组件</h2>
          <button className="button primary" onClick={openAssistant}>
            打开侧边助手 <ArrowRight size={16} />
          </button>
        </div>
        <details>
          <summary>使用提示</summary>
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
        </details>
      </Panel>
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
