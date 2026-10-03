const groups = [
  { role: "男生角色", names: ["顾星辰", "江叙白", "秋亦帆", "林泽宇"] },
  { role: "女生角色", names: ["苏晚晴", "夏知柚", "许星眠", "温以宁"] }
];

const createInitialState = () => ({
  names: groups.map(group => [...group.names]),
  plans: groups.map(() => Array(4).fill(""))
});

const state = createInitialState();

try {
  const saved = JSON.parse(localStorage.getItem("travel-plan-sheet") || "null");
  if (saved?.names?.length === 2 && saved.names.every(list => list.length === 4)) {
    state.names = saved.names;
  }
  if (saved?.plans?.length === 2 && saved.plans.every(list => list.length === 4)) {
    state.plans = saved.plans;
  }
} catch (error) {
  console.warn("暂存内容无法读取，已使用空白表格。", error);
}

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="screen">
    <section class="sheet" id="sheet" aria-label="一起旅行吧旅行计划表格">
      <div class="sheet-content">
        <h1 class="main-title">一起旅行吧</h1>
        <div id="tables" style="display:contents"></div>
      </div>
    </section>
    <nav class="actions" aria-label="表格操作">
      <button class="action" id="shuffle" type="button">打乱姓名</button>
      <button class="action primary" id="export" type="button">导出完整图片</button>
      <button class="action" id="exportHidden" type="button">隐藏姓名后导出</button>
      <button class="action" id="clear" type="button">清空填写内容</button>
    </nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>`;

const tables = document.querySelector("#tables");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function renderTables() {
  tables.innerHTML = groups.map((group, groupIndex) => `
    <section class="group" data-group="${groupIndex}">
      <header class="group-heading">
        <span class="role-tag">${group.role}</span>
        <h2 class="group-title">旅行计划</h2>
      </header>
      <div class="table">
        <div class="row">
          <div class="cell head">姓名</div>
          <div class="cell head">填写内容</div>
        </div>
        ${state.names[groupIndex].map((name, rowIndex) => `
          <div class="row">
            <div class="cell name">${name}</div>
            <div class="cell">
              <textarea class="entry" data-group="${groupIndex}" data-row="${rowIndex}"
                aria-label="${name}的旅行计划" maxlength="120" placeholder="点击填写旅行计划">${escapeHtml(state.plans[groupIndex][rowIndex])}</textarea>
            </div>
          </div>`).join("")}
      </div>
    </section>`).join("");
}

function saveState() {
  try {
    localStorage.setItem("travel-plan-sheet", JSON.stringify(state));
  } catch (error) {
    console.warn("暂存失败。", error);
  }
}

tables.addEventListener("input", event => {
  const input = event.target.closest(".entry");
  if (!input) return;
  state.plans[Number(input.dataset.group)][Number(input.dataset.row)] = input.value;
  saveState();
});

window.addEventListener("pagehide", saveState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState();
});

renderTables();

document.querySelector("#shuffle").addEventListener("click", () => {
  document.querySelectorAll(".name").forEach(name => name.classList.add("shuffling"));
  setTimeout(() => {
    state.names = state.names.map(names => shuffleToNewOrder(names));
    saveState();
    renderTables();
    showToast("姓名顺序已打乱");
  }, 140);
});

function shuffleToNewOrder(names) {
  const next = [...names];
  const original = names.join("|");
  for (let attempt = 0; attempt < 8 && next.join("|") === original; attempt++) {
    for (let index = next.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [next[index], next[target]] = [next[target], next[index]];
    }
  }
  if (next.join("|") === original) [next[0], next[1]] = [next[1], next[0]];
  return next;
}

document.querySelector("#clear").addEventListener("click", () => {
  if (!window.confirm("确定要清空全部旅行计划吗？")) return;
  state.plans = groups.map(() => Array(4).fill(""));
  saveState();
  renderTables();
  showToast("填写内容已清空");
});

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

const backgroundImage = new Image();
backgroundImage.src = "background.png";
const backgroundReady = new Promise((resolve, reject) => {
  backgroundImage.onload = resolve;
  backgroundImage.onerror = reject;
});

document.querySelector("#export").addEventListener("click", () => exportSheet(false));
document.querySelector("#exportHidden").addEventListener("click", () => exportSheet(true));

async function exportSheet(hideNames) {
  const buttons = [...document.querySelectorAll(".action")];
  buttons.forEach(button => { button.disabled = true; });
  showToast("正在生成图片…");

  try {
    await Promise.all([backgroundReady, document.fonts?.ready || Promise.resolve()]);
    const canvas = document.createElement("canvas");
    canvas.width = 941;
    canvas.height = 1672;
    const context = canvas.getContext("2d");
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    drawExportContent(context, hideNames);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("图片生成失败");

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `一起旅行吧-${hideNames ? "隐藏姓名" : "完整表格"}-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(hideNames ? "隐藏姓名图片已导出" : "完整图片已导出");
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重试");
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function drawExportContent(context, hideNames) {
  const x = 69;
  const width = 803;

  context.save();
  context.fillStyle = "#53466f";
  context.font = '700 60px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(255,255,255,.94)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 2;
  context.fillText("一起旅行吧", 470.5, 158);
  context.restore();

  const groupHeight = 645;
  const gap = 22;
  const firstY = 228;
  groups.forEach((group, groupIndex) => {
    drawGroup(context, {
      x,
      y: firstY + groupIndex * (groupHeight + gap),
      width,
      height: groupHeight,
      role: group.role,
      names: state.names[groupIndex],
      plans: state.plans[groupIndex],
      hideNames
    });
  });
}

function drawGroup(context, options) {
  const { x, y, width, height, role, names, plans, hideNames } = options;
  const radius = 30;
  const titleHeight = 76;
  const headerHeight = 49;
  const tableY = y + titleHeight;
  const rowHeight = (height - titleHeight - headerHeight) / 4;
  const nameWidth = hideNames ? 0 : width * .29;
  const planWidth = width - nameWidth;
  const lineColor = "rgba(119,101,176,.46)";

  context.save();
  context.shadowColor = "rgba(91,75,143,.14)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 10;
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = "rgba(255,255,255,.52)";
  context.fill();
  context.restore();

  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.fillStyle = "rgba(255,255,255,.44)";
  context.fillRect(x, y, width, height);

  const gradient = context.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, "rgba(231,224,255,.76)");
  gradient.addColorStop(1, "rgba(255,247,252,.74)");
  context.fillStyle = gradient;
  context.fillRect(x, y, width, titleHeight);

  drawRoleTag(context, role, x + 27, y + titleHeight / 2);

  context.fillStyle = "#65558f";
  context.font = '500 32px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("旅行计划", x + width / 2, y + titleHeight / 2);

  context.fillStyle = "rgba(255,255,255,.28)";
  context.fillRect(x, tableY, width, headerHeight);
  if (!hideNames) {
    context.fillStyle = "rgba(244,240,255,.28)";
    context.fillRect(x, tableY + headerHeight, nameWidth, height - titleHeight - headerHeight);
  }

  context.strokeStyle = lineColor;
  context.lineWidth = 1.7;
  context.beginPath();
  context.moveTo(x, tableY);
  context.lineTo(x + width, tableY);
  context.moveTo(x, tableY + headerHeight);
  context.lineTo(x + width, tableY + headerHeight);
  for (let row = 1; row <= 3; row++) {
    const lineY = tableY + headerHeight + row * rowHeight;
    context.moveTo(x, lineY);
    context.lineTo(x + width, lineY);
  }
  if (!hideNames) {
    context.moveTo(x + nameWidth, tableY);
    context.lineTo(x + nameWidth, y + height);
  }
  context.stroke();

  context.fillStyle = "#756d8f";
  context.font = '400 22px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (hideNames) {
    context.fillText("填写内容", x + width / 2, tableY + headerHeight / 2);
  } else {
    context.fillText("姓名", x + nameWidth / 2, tableY + headerHeight / 2);
    context.fillText("填写内容", x + nameWidth + planWidth / 2, tableY + headerHeight / 2);
  }

  for (let row = 0; row < 4; row++) {
    const rowY = tableY + headerHeight + row * rowHeight;
    if (!hideNames) {
      context.fillStyle = "#5d527e";
      context.font = '500 25px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(names[row], x + nameWidth / 2, rowY + rowHeight / 2);
    }

    drawPlanText(
      context,
      plans[row] || "",
      x + nameWidth + 16,
      rowY + 13,
      planWidth - 32,
      rowHeight - 26
    );
  }

  context.restore();
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.strokeStyle = lineColor;
  context.lineWidth = 2.2;
  context.stroke();
  context.restore();
}

function drawRoleTag(context, role, x, centerY) {
  context.save();
  context.font = '400 18px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  const width = Math.ceil(context.measureText(role).width) + 26;
  const height = 32;
  roundedRect(context, x, centerY - height / 2, width, height, 16);
  context.fillStyle = "rgba(255,255,255,.42)";
  context.fill();
  context.strokeStyle = "rgba(119,101,176,.32)";
  context.lineWidth = 1.3;
  context.stroke();
  context.fillStyle = "#786ba0";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(role, x + width / 2, centerY + .5);
  context.restore();
}

function drawPlanText(context, text, x, y, maxWidth, maxHeight) {
  if (!String(text).trim()) return;

  const sizes = [23, 21, 19, 17];
  let selected;
  for (const fontSize of sizes) {
    context.font = `400 ${fontSize}px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
    const lineHeight = Math.round(fontSize * 1.36);
    const lines = wrapText(context, text, maxWidth);
    const capacity = Math.max(1, Math.floor(maxHeight / lineHeight));
    selected = { fontSize, lineHeight, lines, capacity };
    if (lines.length <= capacity) break;
  }

  const visible = selected.lines.slice(0, selected.capacity);
  if (selected.lines.length > selected.capacity) {
    let last = visible[visible.length - 1] || "";
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    visible[visible.length - 1] = `${last}…`;
  }

  context.save();
  context.fillStyle = "#4e4868";
  context.font = `400 ${selected.fontSize}px "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "top";
  visible.forEach((line, index) => {
    context.fillText(line, x, y + index * selected.lineHeight);
  });
  context.restore();
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  const closingPunctuation = new Set("，。！？；：、）》」』】,.!?;:");
  String(text).split("\n").forEach(paragraph => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    let line = "";
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        if (closingPunctuation.has(character)) {
          lines.push(candidate);
          line = "";
        } else {
          lines.push(line);
          line = character;
        }
      } else {
        line = candidate;
      }
    }
    if (line || !lines.length) lines.push(line);
  });
  return lines;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}
