const { need } = require('../../src/workflow/engine');
const ACTIONS = [
  ['proceed-calendar', 'Proceed'],
  ['proceed-times', 'Proceed but select your time your way'],
  ['hold', 'Hold for other candidate review'],
  ['decline', 'Decline to proceed'],
];
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
function managerActions(origin, workspaceId, c) {
  need(/^https:\/\/[^/]+$/.test(origin || ''), 'ORIGIN_REQUIRED', 'A secure workflow origin is required.', 503);
  const actions = c.stageIndex === c.stages.length - 1
    ? [['proceed', 'Proceed toward offer handoff'], ...ACTIONS.slice(2)] : ACTIONS;
  return actions.map(([action, label]) => {
    const query = new URLSearchParams({workspace: workspaceId, case: c.id, action, version: String(c.version)});
    return {label, url: `${origin}/workflow?${query}`};
  });
}
function messageHtml(text, actions = []) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24123f"><div style="white-space:pre-wrap">${escapeHtml(text)}</div>${actions.map(a => `<p><a style="display:inline-block;background:#542093;color:white;padding:12px 16px;border-radius:6px;text-decoration:none" href="${escapeHtml(a.url)}">${escapeHtml(a.label)}</a></p>`).join('')}</div>`;
}
module.exports = { managerActions, messageHtml };
