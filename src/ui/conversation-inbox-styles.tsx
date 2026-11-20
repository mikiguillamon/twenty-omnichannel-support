const stylesheet = `
.omni-inbox {
  --inbox-bg: #fff;
  --inbox-soft: #f7f8fb;
  --inbox-hover: #f3f4f8;
  --inbox-line: #e3e5ec;
  --inbox-text: #232631;
  --inbox-muted: #626779;
  --inbox-accent: #474ac1;
  --inbox-accent-bg: #eeefff;
  --inbox-good: #187150;
  --inbox-good-bg: #e6f5ed;
  --inbox-warn: #80521c;
  --inbox-warn-bg: #fff1d9;
  --inbox-error: #a13042;
  --inbox-error-bg: #fff2f3;
  box-sizing: border-box;
  container: omni-inbox / inline-size;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  padding: clamp(14px, 2.6vw, 34px);
  color: var(--inbox-text);
  background: var(--inbox-bg);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  color-scheme: light;
}
.omni-inbox[data-theme="dark"] {
  --inbox-bg: #191b22;
  --inbox-soft: #21242d;
  --inbox-hover: #282c36;
  --inbox-line: #353a48;
  --inbox-text: #eff0f6;
  --inbox-muted: #b1b6c7;
  --inbox-accent: #b4baff;
  --inbox-accent-bg: #30335f;
  --inbox-good: #8ed5b3;
  --inbox-good-bg: #1b392f;
  --inbox-warn: #efc98e;
  --inbox-warn-bg: #403221;
  --inbox-error: #ffc0c8;
  --inbox-error-bg: #412a32;
  color-scheme: dark;
}
.omni-inbox :where(button, input, select) { font: inherit; color: inherit; }
.omni-inbox :where(button, input, select, summary, a):focus-visible {
  outline: 2px solid var(--inbox-accent); outline-offset: 2px;
}
.omni-inbox h1, .omni-inbox h2, .omni-inbox p { margin: 0; }
.omni-inbox__heading, .omni-inbox__toolbar, .omni-inbox__actions,
.omni-inbox__controls, .omni-inbox__pager, .omni-inbox__thread-title {
  display: flex; align-items: center; flex-wrap: wrap; gap: 9px 12px;
}
.omni-inbox__heading, .omni-inbox__pager, .omni-inbox__thread-title { justify-content: space-between; }
.omni-inbox__heading { align-items: flex-start; margin-bottom: 20px; }
.omni-inbox__heading h1 { font-size: 28px; line-height: 1.15; letter-spacing: -.025em; font-weight: 650; }
.omni-inbox__toolbar { justify-content: space-between; margin-bottom: 12px; }
.omni-inbox__toolbar .omni-inbox__field { max-width: min(100%, 280px); }
.omni-inbox__control { display: inline-flex; align-items: center; gap: 7px; }
.omni-inbox__control, .omni-inbox__select, .omni-inbox__input {
  box-sizing: border-box; min-height: 36px; border-radius: 7px;
  border: 1px solid var(--inbox-line); background: var(--inbox-bg); padding: 6px 10px;
}
.omni-inbox__control { justify-content: center; cursor: pointer; white-space: nowrap; font-weight: 550; }
.omni-inbox__control:hover:not(:disabled) { background: var(--inbox-hover); }
.omni-inbox__control:disabled, .omni-inbox__select:disabled { opacity: .55; cursor: default; }
.omni-inbox__control[data-primary="true"] {
  color: #fff; background: #474ac1; border-color: #474ac1;
}
.omni-inbox__control[data-primary="true"]:hover:not(:disabled) { background: #36399e; }
.omni-inbox__select, .omni-inbox__input { min-width: 0; }
.omni-inbox__input::placeholder { color: var(--inbox-muted); }
.omni-inbox__filterbar {
  border: 1px solid var(--inbox-line); border-radius: 10px;
  padding: 13px; margin-bottom: 16px; background: var(--inbox-soft);
}
.omni-inbox__controls { align-items: flex-end; }
.omni-inbox__field { display: grid; gap: 4px; min-width: 0; }
.omni-inbox__field > span { font-size: 12px; font-weight: 550; color: var(--inbox-muted); }
.omni-inbox__search { flex: 1 1 250px; min-width: 0; position: relative; display: block; }
.omni-inbox__search svg { position: absolute; left: 11px; top: 10px; color: var(--inbox-muted); pointer-events: none; }
.omni-inbox__search input { width: 100%; padding-left: 34px; }
.omni-inbox__filters {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(147px, 100%), 1fr)); gap: 9px;
  margin-top: 12px;
}
.omni-inbox__view-editor {
  display: flex; align-items: flex-end; flex-wrap: wrap; gap: 8px;
  padding: 10px 0 14px;
}
.omni-inbox__view-editor .omni-inbox__field { flex: 1 1 220px; max-width: 460px; }
.omni-inbox__note { color: var(--inbox-muted); font-size: 12px; }
.omni-inbox__notice { margin: 0 0 12px; color: var(--inbox-good); }
.omni-inbox__alert { background: var(--inbox-error-bg); color: var(--inbox-error); padding: 9px 12px; border-radius: 7px; margin-bottom: 12px; }
.omni-inbox__workspace { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); align-items: start; }
.omni-inbox__list {
  container: omni-list / inline-size;
  min-width: 0; border: 1px solid var(--inbox-line); border-radius: 10px; overflow: hidden;
}
.omni-inbox__table-scroll { overflow-x: auto; }
.omni-inbox__table { width: 100%; border-collapse: collapse; table-layout: auto; text-align: left; }
.omni-inbox__table th {
  background: var(--inbox-soft); color: var(--inbox-muted); font-size: 12px; font-weight: 600; white-space: nowrap;
}
.omni-inbox__table :where(th, td) { padding: 10px 13px; border-bottom: 1px solid var(--inbox-line); }
.omni-inbox__table tr[data-open="true"] td { background: var(--inbox-accent-bg); }
.omni-inbox__table tbody tr:hover td { background: var(--inbox-hover); }
.omni-inbox__table tr[data-open="true"]:hover td { background: var(--inbox-accent-bg); }
.omni-inbox__subject {
  display: grid; gap: 3px; text-align: left; width: 100%; padding: 3px 0;
  border: 0; background: transparent; cursor: pointer;
}
.omni-inbox__subject strong { overflow-wrap: anywhere; font-weight: 650; }
.omni-inbox__subject:hover strong { color: var(--inbox-accent); text-decoration: underline; text-underline-offset: 3px; }
.omni-inbox__primary-cell { width: 37%; min-width: 160px; }
.omni-inbox__time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.omni-inbox__muted { color: var(--inbox-muted); }
.omni-inbox__pill {
  display: inline-flex; align-items: center; white-space: nowrap; max-width: 100%; gap: 4px;
  color: var(--inbox-muted); background: var(--inbox-soft); padding: 3px 7px;
  border-radius: 5px; font-size: 12px; font-weight: 550;
}
.omni-inbox__pill[data-tone="accent"] { background: var(--inbox-accent-bg); color: var(--inbox-accent); }
.omni-inbox__pill[data-tone="warn"] { background: var(--inbox-warn-bg); color: var(--inbox-warn); }
.omni-inbox__pill[data-tone="good"] { background: var(--inbox-good-bg); color: var(--inbox-good); }
.omni-inbox__state { min-height: 154px; padding: 18px; display: grid; align-content: center; justify-items: center; gap: 6px; text-align: center; }
.omni-inbox__state strong { font-size: 15px; }
.omni-inbox__skeleton { background: var(--inbox-soft); height: 10px; width: 80%; display: inline-block; border-radius: 4px; }
.omni-inbox__visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.omni-inbox__pager { padding: 9px 13px; color: var(--inbox-muted); font-size: 12px; }
.omni-inbox__detail { min-width: 0; border: 1px solid var(--inbox-line); border-radius: 10px; }
.omni-inbox__detail > header { padding: 14px; border-bottom: 1px solid var(--inbox-line); }
.omni-inbox__thread-title { align-items: flex-start; }
.omni-inbox__thread-title h2 { font-size: 18px; letter-spacing: -.01em; line-height: 1.2; overflow-wrap: anywhere; }
.omni-inbox__thread-meta { margin: 10px 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.omni-inbox__context { display: grid; gap: 9px; margin: 12px 0 0; }
.omni-inbox__context summary { cursor: pointer; color: var(--inbox-accent); font-weight: 550; }
.omni-inbox__context :where(p, audio) { margin-top: 7px; max-width: 100%; overflow-wrap: anywhere; white-space: pre-wrap; }
@container omni-inbox (min-width: 1020px) {
  .omni-inbox__workspace[data-has-detail="true"] { grid-template-columns: minmax(0, 1.25fr) minmax(380px, 1fr); }
}
@container omni-inbox (max-width: 1019px) {
  .omni-inbox__list-controls[data-detail-open="true"],
  .omni-inbox__workspace[data-has-detail="true"] .omni-inbox__list { display: none; }
}
@container omni-list (max-width: 780px) {
  .omni-inbox__col-extra { display: none; }
}
@container omni-list (max-width: 500px) {
  .omni-inbox__col-optional { display: none; }
  .omni-inbox__table :where(th, td) { padding: 8px; }
  .omni-inbox__primary-cell { min-width: 125px; }
}
@container omni-inbox (max-width: 435px) {
  .omni-inbox__heading h1 { font-size: 24px; }
  .omni-inbox__toolbar .omni-inbox__field { width: 100%; max-width: 100%; }
}
`;

export function ConversationInboxStyles() {
  return <style>{stylesheet}</style>;
}
