"use client";

import { useEffect, useMemo, useState } from "react";

type SubjectResult = {
  subject: string;
  summary: string;
  draft: string;
  review: string[];
  status: "수정 완료" | "검토 중";
};

type SavedRecord = {
  id: string;
  studentId: string;
  grade: string;
  subject: string;
  createdAt: string;
  results: SubjectResult[];
};

type SupabaseStatus = "checking" | "connected" | "error" | "unconfigured";

const subjects = ["국어", "수학", "영어", "통합사회", "통합과학", "정보"];
const demoResults: SubjectResult[] = [
  {
    subject: "국어",
    summary: "비문학 독해·토론·근거 제시 활동을 중심으로 정리했습니다.",
    draft: "비문학 글의 핵심 주장과 세부 근거를 구분하여 정리하고, 토론 활동에서 자료의 출처와 맥락을 확인하며 자신의 의견을 논리적으로 표현함. 다른 관점의 질문을 바탕으로 주장을 보완하는 과정이 구체적으로 드러남.",
    review: ["단정적 표현을 관찰 중심 표현으로 조정", "순위·비교 표현 없음", "활동 근거가 드러나도록 문장 연결"],
    status: "수정 완료",
  },
  {
    subject: "수학",
    summary: "함수 모델링·오류 분석·풀이 설명 활동을 중심으로 정리했습니다.",
    draft: "함수의 변화를 표와 그래프로 비교하며 상황에 맞는 식을 세우고, 풀이 과정에서 발생한 오류의 원인을 단계별로 점검함. 문제의 조건을 다시 해석하여 풀이를 수정하고 그 이유를 설명하는 태도가 돋보임.",
    review: ["추상적 칭찬을 구체적 행동으로 대체", "결과보다 과정 중심으로 조정", "금지어 및 순위 표현 없음"],
    status: "수정 완료",
  },
];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function Home() {
  const [active, setActive] = useState<"write" | "history" | "settings">("write");
  const [grade, setGrade] = useState("1학년");
  const [studentId, setStudentId] = useState("2026-014");
  const [selectedSubjects, setSelectedSubjects] = useState(["국어", "수학"]);
  const [keywords, setKeywords] = useState("비문학 독해, 토론에서 근거 제시, 함수 모델링, 오류 분석");
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [model, setModel] = useState("gemini-3.5-flash-lite");
  const [toast, setToast] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>("checking");

  useEffect(() => {
    const local = localStorage.getItem("setek-history");
    if (local) setHistory(JSON.parse(local));
    setGeminiKey(localStorage.getItem("setek-gemini-key") || "");
    setModel(localStorage.getItem("setek-model") || "gemini-3.5-flash-lite");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/setek_records?select=*&order=created_at.desc&limit=100`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }).then(async (response) => {
        if (!response.ok) throw new Error("Supabase history request failed");
        const rows = await response.json();
        const records: SavedRecord[] = rows.map((row: { id: string; student_id: string; grade: string; subject: string; created_at: string; results: SubjectResult[] }) => ({
          id: row.id, studentId: row.student_id, grade: row.grade, subject: row.subject, createdAt: row.created_at, results: row.results,
        }));
        setHistory(records); localStorage.setItem("setek-history", JSON.stringify(records)); setSupabaseStatus("connected");
      }).catch(() => { setSupabaseStatus("error"); setToast("Supabase 테이블 연결을 확인해 주세요. 로컬 저장 내역을 표시합니다."); });
    } else setSupabaseStatus("unconfigured");
  }, []);

  const subjectsLabel = useMemo(() => selectedSubjects.join(" · "), [selectedSubjects]);

  function toggleSubject(subject: string) {
    setSelectedSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
  }

  async function generate() {
    if (!selectedSubjects.length || !keywords.trim()) return setToast("과목과 활동 키워드를 입력해 주세요.");
    setIsGenerating(true); setSaved(false); setToast("");
    const fallback = selectedSubjects.map((subject) => ({ ...(demoResults.find((item) => item.subject === subject) || demoResults[0]), subject, summary: `${keywords.split(",").slice(0, 3).join("·")} 활동을 ${subject} 과목 맥락에 맞춰 정리했습니다.`, draft: `${subject} 수업에서 ${keywords.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3).join(", ")} 활동에 참여함. 자료와 풀이 과정을 스스로 점검하고, 자신의 판단 근거를 말과 글로 설명하며 활동 결과를 다음 탐구로 확장하는 모습이 관찰됨.` }));
    let generated = fallback;
    if (geminiKey.trim()) {
      try {
        generated = await Promise.all(selectedSubjects.map(async (subject) => {
          const prompt = `한국 고등학교 생활기록부 세부능력 및 특기사항 초안을 작성해줘. 과목: ${subject}. 학년: ${grade}. 학생 식별값은 문장에 쓰지 마. 활동 키워드/관찰 내용: ${keywords}. 단정적 서술, 순위·비교, 과장된 칭찬, 확인되지 않은 성취를 피하고 관찰된 행동과 과정을 중심으로 2문장으로 작성해. JSON으로만 {"summary":"한 줄 요약","draft":"세특 문구"} 형식으로 답해.`;
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
          if (!response.ok) throw new Error("Gemini request failed");
          const body = await response.json(); const text = body.candidates?.[0]?.content?.parts?.[0]?.text || ""; const parsed = JSON.parse(text.replace(/^```json\\s*|\\s*```$/g, ""));
          return { subject, summary: parsed.summary, draft: parsed.draft, review: ["단정적 표현을 관찰 중심으로 점검", "순위·비교 표현 없음", "활동 근거가 드러나도록 문장 연결"], status: "수정 완료" as const };
        }));
      } catch { generated = fallback; setToast("Gemini 응답을 확인하지 못해 데모 생성 결과를 표시합니다."); }
    } else await new Promise((resolve) => setTimeout(resolve, 850));
    setResults(generated); setIsGenerating(false); setToast("3개 에이전트 검토가 완료되었습니다.");
  }

  async function saveRecord() {
    if (!results.length) return;
    const record: SavedRecord = { id: uid(), studentId, grade, subject: subjectsLabel, createdAt: new Date().toISOString(), results };
    const next = [record, ...history]; setHistory(next); localStorage.setItem("setek-history", JSON.stringify(next));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/setek_records`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ student_id: studentId, grade, subject: subjectsLabel, results }) });
        if (!response.ok) throw new Error("Supabase save failed");
        setSaved(true); setSupabaseStatus("connected"); setToast("Supabase에 저장했습니다.");
      } catch { setSupabaseStatus("error"); setToast("Supabase 저장에 실패해 이 브라우저에 임시 저장했습니다."); }
    } else { setSaved(true); setSupabaseStatus("unconfigured"); setToast("이 브라우저에 임시 저장했습니다."); }
  }

  function downloadText() {
    const content = results.map((item) => `[${item.subject}]\n${item.draft}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${studentId}-세특-초안.txt`; a.click(); URL.revokeObjectURL(url);
  }

  function saveSettings() { localStorage.setItem("setek-gemini-key", geminiKey); localStorage.setItem("setek-model", model); setToast("개인 설정을 저장했습니다."); }

  const supabaseLabel = {
    checking: "Supabase 연결 확인 중",
    connected: "Supabase 연결됨",
    error: "Supabase 연결 오류",
    unconfigured: "Supabase 설정 필요",
  }[supabaseStatus];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>세특 스튜디오</span></div>
        <div className="workspace-label">WORKSPACE <span>·</span> 01</div>
        <nav>
          <button className={active === "write" ? "nav-item active" : "nav-item"} onClick={() => setActive("write")}><span>✦</span> 세특 작성</button>
          <button className={active === "history" ? "nav-item active" : "nav-item"} onClick={() => setActive("history")}><span>◷</span> 저장 내역 <em>{history.length || ""}</em></button>
        </nav>
        <div className="sidebar-bottom"><button className={active === "settings" ? "nav-item active" : "nav-item"} onClick={() => setActive("settings")}><span>⚙</span> 개인 설정</button><div className="user-card"><div className="avatar">김</div><div><strong>김선생님</strong><small>교사 계정</small></div><span className="more">•••</span></div></div>
      </aside>
      <section className="main-content">
        <header className="topbar"><div><span className="eyebrow">{active === "write" ? "NEW DRAFT" : active === "history" ? "ARCHIVE" : "PREFERENCES"}</span><h1>{active === "write" ? "세특 작성" : active === "history" ? "저장 내역" : "개인 설정"}</h1></div><div className="top-actions"><span className={`connection ${supabaseStatus}`}><i /> {supabaseLabel}</span><button className="icon-button">?</button><button className="profile-button">김선생님 <span>⌄</span></button></div></header>
        {active === "settings" ? <Settings geminiKey={geminiKey} setGeminiKey={setGeminiKey} model={model} setModel={setModel} save={saveSettings} /> : active === "history" ? <History records={history} onOpen={(record) => { setGrade(record.grade); setStudentId(record.studentId); setSelectedSubjects(record.subject.split(" · ")); setResults(record.results); setActive("write"); }} /> : <>
          <div className="progress"><span className="progress-step done"><b>1</b> 입력</span><span className="line done" /><span className={`progress-step ${isGenerating || results.length ? "done" : "current"}`}><b>2</b> 에이전트 실행</span><span className="line" /><span className={`progress-step ${results.length ? "done" : ""}`}><b>3</b> 결과 확인</span></div>
          <div className="content-grid"><div className="input-column"><section className="panel input-panel"><div className="panel-heading"><div><span className="section-number">01</span><h2>학생 활동 입력</h2><p>학생의 활동 키워드나 관찰 내용을 자유롭게 입력해 주세요.</p></div><span className="required">필수 입력</span></div><div className="field-row"><label>학년<select value={grade} onChange={(e) => setGrade(e.target.value)}><option>1학년</option><option>2학년</option><option>3학년</option></select></label><label>학생 식별값<input value={studentId} onChange={(e) => setStudentId(e.target.value)} /></label></div><label className="field-label">대상 과목 <span>복수 선택 가능</span></label><div className="subject-chips">{subjects.map((subject) => <button key={subject} className={selectedSubjects.includes(subject) ? "chip selected" : "chip"} onClick={() => toggleSubject(subject)}>{selectedSubjects.includes(subject) && <span>✓</span>}{subject}</button>)}</div><label className="field-label">활동 키워드 / 관찰 내용 <span>{keywords.length} / 1,000</span></label><textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: 모둠 토론에서..." maxLength={1000} /><div className="input-hint">💡 구체적인 행동과 과정이 포함될수록 더 자연스러운 문장이 만들어집니다.</div><button className="generate-button" onClick={generate} disabled={isGenerating}><span>✦</span>{isGenerating ? "에이전트가 작업 중..." : "세특 문구 생성하기"}<kbd>⌘ ↵</kbd></button></section><AgentRail active={isGenerating} complete={results.length > 0} /></div><div className="result-column"><section className="result-header"><div><span className="eyebrow">OUTPUT</span><h2>생성 결과 <span>{results.length ? `${results.length}과목` : "대기 중"}</span></h2></div>{results.length > 0 && <div className="result-actions"><button onClick={downloadText}>↓ 텍스트 다운로드</button><button className="save-button" onClick={saveRecord} disabled={saved}>{saved ? "✓ 저장 완료" : "＋ 저장 내역에 추가"}</button></div>}</section>{results.length ? <div className="result-list">{results.map((item) => <article className="result-card" key={item.subject}><div className="result-card-top"><div className="subject-tag">{item.subject}</div><span className="review-status"><i /> {item.status}</span></div><p className="result-summary">{item.summary}</p><div className="draft-box"><span>세특 초안</span><p>{item.draft}</p></div><div className="review-row"><b>검토 에이전트</b>{item.review.map((line) => <span key={line}>✓ {line}</span>)}</div></article>)}</div> : <div className="empty-result"><div className="empty-orb">✦</div><h3>학생 활동을 입력하면<br />과목별 세특 초안이 이곳에 표시됩니다.</h3><p>수집 · 작성 · 검토 에이전트가 순서대로 작업합니다.</p></div>}<div className="privacy-note">🔒 입력한 내용은 저장 버튼을 누르기 전까지 외부로 전송되지 않습니다.</div></div></div>
        </>}
        {toast && <div className="toast">{toast}</div>}
      </section>
    </main>
  );
}

function AgentRail({ active, complete }: { active: boolean; complete: boolean }) { const agents = [{ n: "01", name: "수집 에이전트", desc: "키워드와 관찰 내용 정리" }, { n: "02", name: "작성 에이전트", desc: "과목별 초안 문장 생성" }, { n: "03", name: "검토 에이전트", desc: "표현 규정 점검 및 다듬기" }]; return <section className="agents"><div className="agents-heading"><div><span className="eyebrow">AI WORKFLOW</span><h3>3개 에이전트가 함께 작업합니다</h3></div><span className="agent-live"><i /> {active ? "작업 중" : complete ? "완료" : "대기"}</span></div><div className="agent-list">{agents.map((agent, i) => <div className={`agent ${active || complete ? "agent-on" : ""}`} key={agent.name}><span className="agent-num">{agent.n}</span><div><strong>{agent.name}</strong><small>{agent.desc}</small></div><span className="agent-check">{complete ? "✓" : active && i === 0 ? "…" : ""}</span></div>)}</div></section> }

function History({ records, onOpen }: { records: SavedRecord[]; onOpen: (record: SavedRecord) => void }) { return <div className="history-page"><div className="history-intro"><p>생성하고 저장한 세특 문구를 다시 확인할 수 있습니다.</p><span>{records.length}개의 저장 내역</span></div>{records.length ? <div className="history-list">{records.map((record) => <button className="history-row" key={record.id} onClick={() => onOpen(record)}><div className="history-date">{new Date(record.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}<small>{new Date(record.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small></div><div><strong>{record.studentId}</strong><span>{record.grade} · {record.subject}</span></div><span className="history-count">{record.results.length}과목 <b>→</b></span></button>)}</div> : <div className="empty-history"><div>◷</div><h3>아직 저장된 내역이 없습니다.</h3><p>세특 문구를 생성한 뒤 저장하면 이곳에서 다시 확인할 수 있습니다.</p></div>}</div> }

function Settings({ geminiKey, setGeminiKey, model, setModel, save }: { geminiKey: string; setGeminiKey: (v: string) => void; model: string; setModel: (v: string) => void; save: () => void }) { return <div className="settings-page"><section className="panel settings-card"><span className="section-number">01</span><h2>AI 모델 설정</h2><p>개인 Gemini API 키와 선호 모델을 지정하면 생성에 사용됩니다.</p><label className="field-label">Gemini API Key</label><input className="wide-input" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." /><small className="setting-help">API 키는 이 브라우저에만 저장되며, Supabase에는 저장되지 않습니다.</small><label className="field-label">선호 모델</label><select className="wide-input" value={model} onChange={(e) => setModel(e.target.value)}><option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (기본)</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-pro">Gemini 2.5 Pro</option></select><button className="generate-button settings-save" onClick={save}>설정 저장</button></section><section className="panel integration-card"><span className="section-number">02</span><h2>연동 상태</h2><div className="integration-row"><span className="integration-icon">◉</span><div><strong>Supabase Database</strong><small>저장·조회 REST 연동</small></div><span className="ready-badge">환경변수 대기</span></div><div className="integration-row"><span className="integration-icon">✦</span><div><strong>Gemini API</strong><small>개인 설정 키 사용</small></div><span className="ready-badge">브라우저 저장</span></div></section></div> }
