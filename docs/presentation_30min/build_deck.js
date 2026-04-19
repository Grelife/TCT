const path = require("path");
const pptxgen = require("pptxgenjs");
const {
  autoFontSize,
  calcTextBoxHeightSimple,
  codeToRuns,
  latexToSvgDataUri,
  warnIfSlideHasOverlaps,
  warnIfSlideElementsOutOfBounds,
} = require("./pptxgenjs_helpers");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "OpenAI";
pptx.subject = "TPM 安全文件保险箱课程设计答辩";
pptx.title = "TPM 安全文件保险箱课程设计答辩";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};

const ShapeType = pptx.ShapeType;
const TOTAL_SLIDES = 20;
const FONT = {
  head: "Microsoft YaHei",
  body: "Microsoft YaHei",
  mono: "Consolas",
};
const C = {
  bg: "F5F7FB",
  panel: "FFFFFF",
  title: "12284A",
  navy: "0D1F3C",
  cyan: "157A9C",
  blue: "2C5D8A",
  orange: "D9892B",
  green: "2E8B57",
  red: "C0392B",
  border: "D7E0EB",
  text: "24364B",
  muted: "5F738A",
  codeBg: "0F172A",
  codeBorder: "2D3C5A",
  lightBlue: "E9F4FB",
  lightOrange: "FFF3E6",
  lightGreen: "EAF7EF",
  lightRed: "FDEDEC",
};

function finalizeSlide(slide) {
  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

function addShell(slide, title, section, page, lead) {
  slide.background = { color: C.bg };
  slide.addShape(ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.42,
    line: { color: C.navy, pt: 0 },
    fill: { color: C.navy },
  });
  slide.addShape(ShapeType.rect, {
    x: 0,
    y: 7.22,
    w: 13.333,
    h: 0.28,
    line: { color: C.navy, pt: 0 },
    fill: { color: C.navy },
  });
  slide.addShape(ShapeType.line, {
    x: 0.65,
    y: 1.1,
    w: 12.0,
    h: 0,
    line: { color: C.border, pt: 1.2 },
  });

  slide.addText(
    title,
    autoFontSize(title, FONT.head, {
      x: 0.65,
      y: 0.58,
      w: 8.7,
      h: 0.34,
      fontFace: FONT.head,
      fontSize: 26,
      minFontSize: 22,
      maxFontSize: 28,
      color: C.title,
      bold: true,
      margin: 0,
    })
  );

  if (lead) {
    slide.addText(lead, {
      x: 0.67,
      y: 0.96,
      w: 8.9,
      h: 0.18,
      fontFace: FONT.body,
      fontSize: 11,
      color: C.muted,
      margin: 0,
    });
  }

  slide.addShape(ShapeType.roundRect, {
    x: 10.15,
    y: 0.57,
    w: 1.58,
    h: 0.3,
    rectRadius: 0.06,
    line: { color: C.cyan, pt: 0 },
    fill: { color: C.cyan },
  });
  slide.addText(section, {
    x: 10.18,
    y: 0.62,
    w: 1.52,
    h: 0.1,
    fontFace: FONT.body,
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
    align: "center",
    margin: 0,
  });
  slide.addText(`${page}/${TOTAL_SLIDES}`, {
    x: 12.0,
    y: 0.62,
    w: 0.65,
    h: 0.1,
    fontFace: FONT.body,
    fontSize: 11,
    bold: true,
    color: C.muted,
    align: "right",
    margin: 0,
  });
  slide.addText("TPM 安全文件保险箱课程设计答辩", {
    x: 0.65,
    y: 7.26,
    w: 3.6,
    h: 0.08,
    fontFace: FONT.body,
    fontSize: 9,
    color: "E6EEF8",
    margin: 0,
  });
}

function addPanel(slide, x, y, w, h, fill = C.panel, title = null) {
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    line: { color: C.border, pt: 1 },
    fill: { color: fill },
  });
  if (title) {
    slide.addText(title, {
      x: x + 0.16,
      y: y + 0.12,
      w: w - 0.32,
      h: 0.12,
      fontFace: FONT.head,
      fontSize: 14,
      bold: true,
      color: C.title,
      margin: 0,
    });
  }
}

function bulletRuns(items) {
  return items.map((item, idx) => {
    const entry = typeof item === "string" ? { text: item, level: 0 } : item;
    return {
      text: entry.text,
      options: {
        bullet: { indent: entry.level === 0 ? 16 : 28 },
        breakLine: idx !== items.length - 1,
        fontFace: FONT.body,
        color: C.text,
        paraSpaceAfterPt: 6,
      },
    };
  });
}

function addBulletList(slide, items, x, y, w, fontSize = 18, color = C.text) {
  const h = calcTextBoxHeightSimple(fontSize, items.length * 1.35, 1.2, 0.18);
  slide.addText(
    bulletRuns(items).map((r) => ({
      text: r.text,
      options: { ...r.options, color, fontSize },
    })),
    {
      x,
      y,
      w,
      h,
      fontFace: FONT.body,
      fontSize,
      color,
      valign: "top",
      margin: 0.02,
    }
  );
}

function addCodePanel(slide, title, code, language, x, y, w, h) {
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    line: { color: C.codeBorder, pt: 1 },
    fill: { color: C.codeBg },
  });
  slide.addText(title, {
    x: x + 0.14,
    y: y + 0.08,
    w: w - 0.28,
    h: 0.12,
    fontFace: FONT.body,
    fontSize: 11,
    bold: true,
    color: "BFD7FF",
    margin: 0,
  });
  slide.addText(codeToRuns(code, language), {
    x: x + 0.14,
    y: y + 0.28,
    w: w - 0.28,
    h: h - 0.36,
    fontFace: FONT.mono,
    fontSize: 10.5,
    color: "EAF2FF",
    margin: 0,
    valign: "top",
  });
}

function addStatCard(slide, x, y, w, h, title, body, accent, lightFill) {
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    line: { color: accent, pt: 1.2 },
    fill: { color: lightFill },
  });
  slide.addText(title, {
    x: x + 0.16,
    y: y + 0.13,
    w: w - 0.32,
    h: 0.14,
    fontFace: FONT.head,
    fontSize: 16,
    bold: true,
    color: accent,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.16,
    y: y + 0.38,
    w: w - 0.32,
    h: h - 0.48,
    fontFace: FONT.body,
    fontSize: 11.5,
    color: C.text,
    valign: "top",
    margin: 0,
  });
}

function addOutputBox(slide, title, body, x, y, w, h) {
  addPanel(slide, x, y, w, h, C.panel, title);
  slide.addText(body, {
    x: x + 0.16,
    y: y + 0.38,
    w: w - 0.32,
    h: h - 0.5,
    fontFace: FONT.mono,
    fontSize: 10.5,
    color: C.text,
    margin: 0,
    valign: "top",
  });
}

function addFlowArrow(slide, x, y, w, h, text, fill) {
  slide.addShape(ShapeType.chevron, {
    x,
    y,
    w,
    h,
    line: { color: fill, pt: 1 },
    fill: { color: fill },
  });
  slide.addText(text, {
    x: x + 0.12,
    y: y + 0.16,
    w: w - 0.28,
    h: 0.14,
    fontFace: FONT.body,
    fontSize: 12,
    bold: true,
    color: "FFFFFF",
    align: "center",
    margin: 0,
  });
}

// Slide 1
{
  const slide = pptx.addSlide();
  slide.background = { color: C.navy };
  slide.addShape(ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    line: { color: C.navy, pt: 0 },
    fill: { color: C.navy },
  });
  slide.addShape(ShapeType.rect, {
    x: 0.55,
    y: 0.55,
    w: 0.18,
    h: 5.9,
    line: { color: C.cyan, pt: 0 },
    fill: { color: C.cyan },
  });
  slide.addText("TPM 安全文件保险箱", {
    x: 0.95,
    y: 0.9,
    w: 6.2,
    h: 0.6,
    fontFace: FONT.head,
    fontSize: 28,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });
  slide.addText("30 分钟课程设计答辩 PPT", {
    x: 0.98,
    y: 1.62,
    w: 4.8,
    h: 0.2,
    fontFace: FONT.body,
    fontSize: 16,
    color: "C8D7EC",
    margin: 0,
  });
  slide.addText(
    "关键词：PCR 度量、数据密封、远程证明、PKCS#11、TPM 资源管理器",
    {
      x: 0.98,
      y: 2.0,
      w: 6.25,
      h: 0.18,
      fontFace: FONT.body,
      fontSize: 12,
      color: "D8E4F4",
      margin: 0,
    }
  );
  slide.addText(
    "本次汇报会从系统目标出发，按脚本执行顺序讲清楚每个模块负责什么、为什么这么设计、代码里是如何落地的，最后再用真实实验结果证明系统确实工作。",
    {
      x: 0.98,
      y: 2.45,
      w: 5.8,
      h: 1.1,
      fontFace: FONT.body,
      fontSize: 16,
      color: "F4F7FB",
      valign: "mid",
      margin: 0,
    }
  );
  const pillars = [
    ["系统目标", C.lightBlue, C.cyan],
    ["脚本职责", C.lightOrange, C.orange],
    ["理论与代码", C.lightGreen, C.green],
    ["实验效果", C.lightRed, C.red],
  ];
  pillars.forEach((p, idx) => {
    const row = idx < 2 ? 0 : 1;
    const col = idx % 2;
    const x = 7.65 + col * 2.55;
    const y = 1.15 + row * 1.35;
    slide.addShape(ShapeType.roundRect, {
      x,
      y,
      w: 2.2,
      h: 0.95,
      rectRadius: 0.06,
      line: { color: p[2], pt: 1 },
      fill: { color: p[1] },
    });
    slide.addText(p[0], {
      x: x + 0.12,
      y: y + 0.34,
      w: 1.96,
      h: 0.18,
      fontFace: FONT.head,
      fontSize: 16,
      bold: true,
      color: p[2],
      align: "center",
      margin: 0,
    });
  });
  addPanel(slide, 7.55, 3.95, 5.1, 2.0, C.panel, "本次交付物");
  addBulletList(
    slide,
    [
      "一份 20 页左右、面向 30 分钟答辩节奏的 PowerPoint。",
      "一篇逐页对应的演讲稿，保证讲解顺序和 slide 一致。",
      "保留可编辑的 JS 源文件，后续可以继续改版。",
    ],
    7.76,
    4.3,
    4.65,
    15
  );
  slide.addText("项目仓库：https://github.com/Grelife/TCT.git", {
    x: 0.98,
    y: 6.72,
    w: 6.5,
    h: 0.14,
    fontFace: FONT.body,
    fontSize: 10.5,
    color: "C8D7EC",
    margin: 0,
  });
  slide.addText("1/20", {
    x: 12.15,
    y: 6.72,
    w: 0.5,
    h: 0.14,
    fontFace: FONT.body,
    fontSize: 10.5,
    color: "C8D7EC",
    align: "right",
    margin: 0,
  });
  finalizeSlide(slide);
}

// Slide 2
{
  const slide = pptx.addSlide();
  addShell(slide, "汇报路线与时间分配", "导览", 2, "先给出 30 分钟节奏，再按这个顺序展开。");
  const agenda = [
    ["01", "系统目标与实验拓扑", "为什么做这个系统、拓扑怎么搭起来。", "约 4 分钟", C.cyan],
    ["02", "脚本顺序与职责划分", "00 到 99 各脚本在总目标里负责哪一块。", "约 8 分钟", C.blue],
    ["03", "理论与代码对应讲解", "PCR、Policy、Quote、PKCS#11 对应到具体代码。", "约 10 分钟", C.orange],
    ["04", "实验效果与现象解读", "展示真实输出，说明系统确实成功。", "约 5 分钟", C.green],
    ["05", "安全分析、局限与总结", "说明收益、风险边界和可以继续改进的地方。", "约 3 分钟", C.red],
  ];
  agenda.forEach((item, idx) => {
    const y = 1.35 + idx * 1.07;
    slide.addShape(ShapeType.roundRect, {
      x: 0.85,
      y,
      w: 1.0,
      h: 0.62,
      rectRadius: 0.05,
      line: { color: item[4], pt: 0 },
      fill: { color: item[4] },
    });
    slide.addText(item[0], {
      x: 0.98,
      y: y + 0.18,
      w: 0.72,
      h: 0.16,
      fontFace: FONT.head,
      fontSize: 17,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    });
    addPanel(slide, 2.0, y - 0.03, 9.25, 0.68);
    slide.addText(item[1], {
      x: 2.18,
      y: y + 0.08,
      w: 3.2,
      h: 0.12,
      fontFace: FONT.head,
      fontSize: 15,
      bold: true,
      color: C.title,
      margin: 0,
    });
    slide.addText(item[2], {
      x: 2.18,
      y: y + 0.3,
      w: 6.7,
      h: 0.12,
      fontFace: FONT.body,
      fontSize: 11,
      color: C.muted,
      margin: 0,
    });
    slide.addText(item[3], {
      x: 9.6,
      y: y + 0.22,
      w: 1.4,
      h: 0.12,
      fontFace: FONT.body,
      fontSize: 11.5,
      bold: true,
      color: item[4],
      align: "right",
      margin: 0,
    });
  });
  addPanel(slide, 11.55, 1.34, 1.1, 5.25, C.lightBlue, "节奏提醒");
  slide.addText(
    "前半段讲“系统是怎么搭起来并跑起来的”，后半段讲“理论怎么落到代码上，以及实验结果说明了什么”。",
    {
      x: 11.7,
      y: 1.82,
      w: 0.8,
      h: 4.4,
      fontFace: FONT.body,
      fontSize: 11,
      color: C.text,
      valign: "mid",
      margin: 0.03,
    }
  );
  finalizeSlide(slide);
}

// Slide 3
{
  const slide = pptx.addSlide();
  addShell(slide, "系统目标与设计动机", "目标", 3, "先回答老师最关心的问题：这个系统究竟想解决什么。");
  addPanel(slide, 0.8, 1.35, 6.0, 5.45, C.panel, "要解决的四类安全问题");
  addBulletList(
    slide,
    [
      "完整性问题：系统配置或启动链被篡改后，如何留下不可抵赖的状态痕迹？",
      "机密性问题：敏感数据如何不仅“被加密”，而且“只在可信状态下可用”？",
      "可验证性问题：远程管理员如何确认平台没有被静默替换或重放旧状态？",
      "工程复用问题：怎样把 TPM 能力通过标准接口交给浏览器、OpenSSL、SSH 之类的现有软件？",
      "教学问题：怎样把抽象的 TPM 原理拆成学生能一步一步跟着做、跟着看的脚本？",
    ],
    1.0,
    1.8,
    5.55,
    15.5
  );
  addStatCard(
    slide,
    7.05,
    1.38,
    2.45,
    2.05,
    "完整性",
    "PCR 记录平台状态。\n只要启动项或配置变化，PCR 就会变化。",
    C.cyan,
    C.lightBlue
  );
  addStatCard(
    slide,
    9.78,
    1.38,
    2.45,
    2.05,
    "机密性",
    "密封对象绑定 PCR。\n状态对了才能解封秘密。",
    C.orange,
    C.lightOrange
  );
  addStatCard(
    slide,
    7.05,
    3.82,
    2.45,
    2.05,
    "可信证明",
    "AK 对 PCR 和 Nonce 签名。\n验证方能确认状态真实且新鲜。",
    C.green,
    C.lightGreen
  );
  addStatCard(
    slide,
    9.78,
    3.82,
    2.45,
    2.05,
    "标准接口",
    "通过 PKCS#11 把 TPM 暴露成“虚拟智能卡”，降低集成门槛。",
    C.red,
    C.lightRed
  );
  finalizeSlide(slide);
}

// Slide 4
{
  const slide = pptx.addSlide();
  addShell(slide, "实验拓扑与整体架构", "架构", 4, "这一页把“谁和谁通信、为什么要这么连”讲清楚。");
  addPanel(slide, 0.72, 1.35, 6.0, 5.5, C.panel, "实验 1-3：直连 swtpm");
  const layers = [
    ["应用脚本", "02/03/04/06 调用实验逻辑", C.lightBlue, C.cyan],
    ["tpm2-tools", "pcrread / pcrextend / create / quote", "EEF4FF", C.blue],
    ["TCTI = swtpm", "swtpm:host=localhost,port=2321", "F3F7FB", C.title],
    ["swtpm 模拟器", "软件模拟 TPM 2.0 芯片", "FDF2E7", C.orange],
  ];
  layers.forEach((layer, idx) => {
    const y = 1.82 + idx * 1.06;
    slide.addShape(ShapeType.roundRect, {
      x: 1.05,
      y,
      w: 5.3,
      h: 0.72,
      rectRadius: 0.05,
      line: { color: layer[3], pt: 1 },
      fill: { color: layer[2] },
    });
    slide.addText(layer[0], {
      x: 1.22,
      y: y + 0.13,
      w: 1.9,
      h: 0.12,
      fontFace: FONT.head,
      fontSize: 15,
      bold: true,
      color: layer[3],
      margin: 0,
    });
    slide.addText(layer[1], {
      x: 3.28,
      y: y + 0.16,
      w: 2.78,
      h: 0.12,
      fontFace: FONT.body,
      fontSize: 11.5,
      color: C.text,
      align: "right",
      margin: 0,
    });
  });
  for (let i = 0; i < 3; i += 1) {
    slide.addShape(ShapeType.line, {
      x: 3.7,
      y: 2.54 + i * 1.06,
      w: 0,
      h: 0.33,
      line: { color: C.muted, pt: 1.2, endArrowType: "triangle" },
    });
  }

  addPanel(slide, 6.95, 1.35, 5.65, 5.5, C.panel, "实验 4：通过 abrmd 访问 TPM");
  slide.addShape(ShapeType.roundRect, {
    x: 7.25,
    y: 1.82,
    w: 5.05,
    h: 0.74,
    rectRadius: 0.05,
    line: { color: C.green, pt: 1 },
    fill: { color: C.lightGreen },
  });
  slide.addText("05_pkcs11.sh -> tpm2_ptool / pkcs11-tool / openssl", {
    x: 7.42,
    y: 2.04,
    w: 4.7,
    h: 0.12,
    fontFace: FONT.head,
    fontSize: 14,
    bold: true,
    color: C.green,
    margin: 0,
  });
  slide.addShape(ShapeType.line, {
    x: 9.78,
    y: 2.56,
    w: 0,
    h: 0.4,
    line: { color: C.muted, pt: 1.2, endArrowType: "triangle" },
  });
  slide.addShape(ShapeType.roundRect, {
    x: 7.68,
    y: 3.0,
    w: 4.22,
    h: 0.82,
    rectRadius: 0.05,
    line: { color: C.red, pt: 1 },
    fill: { color: C.lightRed },
  });
  slide.addText("tpm2-abrmd 资源管理器", {
    x: 7.9,
    y: 3.18,
    w: 2.15,
    h: 0.12,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.red,
    margin: 0,
  });
  slide.addText("把 TPM 当作“可换页的对象池”，解决多上下文并发访问问题。", {
    x: 7.9,
    y: 3.42,
    w: 3.65,
    h: 0.16,
    fontFace: FONT.body,
    fontSize: 11,
    color: C.text,
    margin: 0,
  });
  slide.addShape(ShapeType.line, {
    x: 9.78,
    y: 3.83,
    w: 0,
    h: 0.42,
    line: { color: C.muted, pt: 1.2, endArrowType: "triangle" },
  });
  slide.addShape(ShapeType.roundRect, {
    x: 7.68,
    y: 4.32,
    w: 4.22,
    h: 0.76,
    rectRadius: 0.05,
    line: { color: C.title, pt: 1 },
    fill: { color: "EFF4FA" },
  });
  slide.addText("TCTI = tabrmd:bus_type=session", {
    x: 7.92,
    y: 4.6,
    w: 3.75,
    h: 0.12,
    fontFace: FONT.body,
    fontSize: 13,
    bold: true,
    color: C.title,
    align: "center",
    margin: 0,
  });
  slide.addShape(ShapeType.line, {
    x: 9.78,
    y: 5.08,
    w: 0,
    h: 0.44,
    line: { color: C.muted, pt: 1.2, endArrowType: "triangle" },
  });
  slide.addShape(ShapeType.roundRect, {
    x: 8.1,
    y: 5.58,
    w: 3.4,
    h: 0.8,
    rectRadius: 0.05,
    line: { color: C.orange, pt: 1 },
    fill: { color: C.lightOrange },
  });
  slide.addText("swtpm：TPM 2.0 模拟器", {
    x: 8.28,
    y: 5.85,
    w: 3.0,
    h: 0.12,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.orange,
    align: "center",
    margin: 0,
  });
  finalizeSlide(slide);
}

// Slide 5
{
  const slide = pptx.addSlide();
  addShell(slide, "脚本全景：从 00 到 99 如何形成闭环", "脚本", 5, "老师如果只看一页，这页应该能看懂整个项目的组织方式。");
  const scriptRows = [
    ["00_env_setup.sh", "环境安装", "安装 swtpm、tpm2-tools、abrmd、PKCS#11 依赖"],
    ["01_start_tpm.sh", "启动平台", "启动模拟器、建立状态目录、验证 TCTI 和 PCR 可读"],
    ["02_measurement.sh", "完整性度量", "让文件状态进入 PCR，为后续 Seal 和 Attestation 打基础"],
    ["03_seal_unseal.sh", "状态绑定", "把秘密与 PCR 状态绑定，实现可信时解封、不可信时拒绝"],
    ["04_attestation.sh", "远程证明", "让验证方确认平台状态真实且 Nonce 匹配"],
    ["05_pkcs11.sh", "标准接口", "把 TPM 暴露成 PKCS#11 令牌，支持标准签名/验签"],
    ["06_full_demo.sh", "系统串联", "把单项能力组织成“安全文件保险箱”完整流程"],
    ["99_cleanup.sh", "环境回收", "停止 swtpm 并删除状态，保证实验可重复开始"],
  ];
  const startX = 0.82;
  const startY = 1.48;
  const col1 = 2.1;
  const col2 = 2.2;
  const col3 = 7.32;
  const rowH = 0.63;
  slide.addShape(ShapeType.roundRect, {
    x: startX,
    y: startY,
    w: col1 + col2 + col3,
    h: rowH * (scriptRows.length + 1),
    rectRadius: 0.03,
    line: { color: C.border, pt: 1 },
    fill: { color: C.panel },
  });
  slide.addShape(ShapeType.rect, {
    x: startX,
    y: startY,
    w: col1 + col2 + col3,
    h: rowH,
    line: { color: C.navy, pt: 0 },
    fill: { color: C.navy },
  });
  const headers = [
    ["脚本", startX, col1],
    ["定位", startX + col1, col2],
    ["对总目标的贡献", startX + col1 + col2, col3],
  ];
  headers.forEach((header) => {
    slide.addText(header[0], {
      x: header[1] + 0.12,
      y: startY + 0.2,
      w: header[2] - 0.24,
      h: 0.12,
      fontFace: FONT.head,
      fontSize: 12.5,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    });
  });
  slide.addShape(ShapeType.line, {
    x: startX + col1,
    y: startY,
    w: 0,
    h: rowH * (scriptRows.length + 1),
    line: { color: C.border, pt: 1 },
  });
  slide.addShape(ShapeType.line, {
    x: startX + col1 + col2,
    y: startY,
    w: 0,
    h: rowH * (scriptRows.length + 1),
    line: { color: C.border, pt: 1 },
  });
  scriptRows.forEach((row, idx) => {
    const y = startY + rowH * (idx + 1);
    slide.addShape(ShapeType.line, {
      x: startX,
      y,
      w: col1 + col2 + col3,
      h: 0,
      line: { color: C.border, pt: 1 },
    });
    slide.addText(row[0], {
      x: startX + 0.12,
      y: y + 0.15,
      w: col1 - 0.24,
      h: 0.24,
      fontFace: FONT.mono,
      fontSize: 10.4,
      color: C.title,
      margin: 0,
    });
    slide.addText(row[1], {
      x: startX + col1 + 0.12,
      y: y + 0.16,
      w: col2 - 0.24,
      h: 0.18,
      fontFace: FONT.head,
      fontSize: 11.2,
      bold: true,
      color: C.blue,
      align: "center",
      margin: 0,
    });
    slide.addText(row[2], {
      x: startX + col1 + col2 + 0.14,
      y: y + 0.11,
      w: col3 - 0.28,
      h: 0.38,
      fontFace: FONT.body,
      fontSize: 10.9,
      color: C.text,
      margin: 0,
      valign: "mid",
    });
  });
  finalizeSlide(slide);
}

// Slide 6
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作一：00_env_setup.sh 做了什么", "脚本", 6, "第一步不是安全算法，而是把实验平台搭对。");
  addPanel(slide, 0.75, 1.35, 5.35, 5.65, C.panel, "脚本职责");
  addBulletList(
    slide,
    [
      "先检查是否为 root 权限，避免安装阶段因为权限不足而失败。",
      "再识别系统版本，明确脚本面向 Ubuntu 22.04。",
      "随后安装 TPM 模拟器、TPM 工具链、资源管理器、PKCS#11 工具和辅助命令。",
      "最后逐个验证关键命令能否执行，并打印版本号作为实验环境证明。",
    ],
    0.96,
    1.85,
    4.85,
    15.2
  );
  addCodePanel(
    slide,
    "关键代码：安装依赖包",
    `PACKAGES=(\n  "swtpm" "swtpm-tools"\n  "tpm2-tools" "libtss2-dev"\n  "tpm2-abrmd" "libtss2-tcti-tabrmd0"\n  "libtpm2-pkcs11-1" "libtpm2-pkcs11-tools"\n  "openssl" "opensc" "dbus"\n)\nfor pkg in "\${PACKAGES[@]}"; do\n  apt-get install -y -qq "$pkg"\ndone`,
    "bash",
    6.32,
    1.38,
    6.2,
    2.55
  );
  addOutputBox(
    slide,
    "实验记录中的关键返回",
    `swtpm: TPM emulator version 0.6.3\ntpm2_pcrread: version=5.2\ntpm2_createprimary: version=5.2\ntpm2_quote: version=5.2\ntpm2_ptool: 已安装`,
    6.32,
    4.18,
    6.2,
    1.55
  );
  addPanel(slide, 6.32, 5.92, 6.2, 1.08, C.lightBlue, "这一脚本对应总目标的哪一块");
  slide.addText(
    "它不直接做安全证明，但它把“实验能否跑起来”这个基础问题一次解决掉。没有 00 脚本，后面的 PCR、Quote、PKCS#11 都只会停留在概念层。",
    {
      x: 6.5,
      y: 6.22,
      w: 5.82,
      h: 0.5,
      fontFace: FONT.body,
      fontSize: 11.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  finalizeSlide(slide);
}

// Slide 7
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作二：01_start_tpm.sh 启动了怎样的 TPM", "脚本", 7, "第二步是把 TPM 模拟器真的跑起来，并验证它不是假启动。");
  addCodePanel(
    slide,
    "核心命令：启动 swtpm",
    `swtpm socket \\\n  --tpmstate dir=/tmp/tpm-vault-state \\\n  --tpm2 \\\n  --ctrl type=tcp,port=2322 \\\n  --server type=tcp,port=2321 \\\n  --flags not-need-init,startup-clear`,
    "bash",
    0.82,
    1.4,
    6.15,
    2.2
  );
  addBulletList(
    slide,
    [
      "2321 是 TPM 命令通道，2322 是控制通道。",
      "状态目录 `/tmp/tpm-vault-state` 会保存 TPM 持久状态。",
      "脚本会先杀掉旧进程，避免上一次实验残留影响当前结果。",
      "启动之后马上执行 `tpm2_startup -c` 和 `tpm2_pcrread sha256:0` 做连通性验证。",
    ],
    0.95,
    3.95,
    5.75,
    15
  );
  addOutputBox(
    slide,
    "实验输出：平台真的已经可用",
    `swtpm 已启动 (PID: 24707)\n服务端口: 2321\n控制端口: 2322\nTCTI: swtpm:host=localhost,port=2321\nPCR 0 = 0x0000000000000000000000000000000000000000000000000000000000000000`,
    7.2,
    1.4,
    5.35,
    2.55
  );
  addPanel(slide, 7.2, 4.2, 5.35, 2.25, C.lightOrange, "它在总目标中的位置");
  slide.addText(
    "01 脚本负责把“理论上的 TPM”变成“脚本能访问的 TPM”。它为后续所有实验提供同一个稳定的硬件抽象：端口、状态目录、TCTI 和连通性验证都在这里固定下来。",
    {
      x: 7.4,
      y: 4.55,
      w: 4.95,
      h: 1.35,
      fontFace: FONT.body,
      fontSize: 12,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  finalizeSlide(slide);
}

// Slide 8
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作三：02_measurement.sh 如何完成 PCR 度量", "脚本", 8, "这里开始进入 TPM 的第一个核心能力：完整性度量。");
  addPanel(slide, 0.78, 1.35, 5.1, 5.65, C.panel, "实验流程");
  addFlowArrow(slide, 1.0, 1.82, 1.0, 0.54, "读 PCR10", C.cyan);
  addFlowArrow(slide, 2.14, 1.82, 1.12, 0.54, "算文件哈希", C.blue);
  addFlowArrow(slide, 3.4, 1.82, 1.12, 0.54, "扩展 PCR", C.orange);
  addFlowArrow(slide, 4.66, 1.82, 1.0, 0.54, "篡改文件", C.red);
  slide.addShape(ShapeType.line, {
    x: 5.18,
    y: 2.38,
    w: 0,
    h: 0.42,
    line: { color: C.muted, pt: 1.2, endArrowType: "triangle" },
  });
  addFlowArrow(slide, 4.66, 2.88, 1.0, 0.54, "再次扩展", C.green);
  slide.addText(
    "目标不是“证明文件安全”，而是“证明平台状态能被 PCR 可靠记录”。脚本复制配置文件到工作目录，然后先读取 PCR 10，再计算哈希、扩展 PCR，最后模拟篡改并再次扩展，观察 PCR 值的链式变化。",
    {
      x: 1.0,
      y: 3.55,
      w: 4.5,
      h: 1.45,
      fontFace: FONT.body,
      fontSize: 12.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  addOutputBox(
    slide,
    "实验输出：PCR 10 的变化",
    `初始: 10:0x0000000000000000000000000000000000000000000000000000000000000000\n第一次扩展后: 10:0x85CCFB9AE4A72E3CB0A96067E37A262D3DFACEA94F1595F18B46F06F1471E0A0\n篡改后文件哈希: 9ed9ed5f34fbd3ad1410370f771b26027505dfcc098eb0ef00df4f9d5c97b9f1\n第二次扩展后: 10:0x2CD101015684E104C032ED6FE458CA4A6EA55686AF7CC0B7367A7D8C6D895E62`,
    6.12,
    1.42,
    6.45,
    3.0
  );
  addPanel(slide, 6.12, 4.7, 6.45, 2.25, C.lightBlue, "它负责总目标中的哪一块");
  slide.addText(
    "02 脚本负责建立“可信状态有痕迹”这件事。如果没有 Measurement，后面的 Seal 无法知道“当前状态和创建时是否一致”，Attestation 也没有可签名的状态摘要。",
    {
      x: 6.32,
      y: 5.08,
      w: 6.02,
      h: 1.2,
      fontFace: FONT.body,
      fontSize: 12.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  finalizeSlide(slide);
}

// Slide 9
{
  const slide = pptx.addSlide();
  addShell(slide, "理论与代码对应一：为什么 PCR 扩展能代表完整性", "理论", 9, "这一页把数学公式、脚本代码和实验现象对应起来。");
  addPanel(slide, 0.78, 1.35, 5.1, 5.6, C.panel, "核心理论");
  slide.addImage({
    data: latexToSvgDataUri("PCR_{new}=SHA256(PCR_{old}\\parallel H(file))"),
    x: 1.0,
    y: 1.82,
    w: 4.65,
    h: 0.52,
  });
  addStatCard(slide, 1.0, 2.55, 1.35, 1.4, "累积性", "新值依赖旧值，因此保留历史。", C.cyan, C.lightBlue);
  addStatCard(slide, 2.55, 2.55, 1.35, 1.4, "不可回退", "不能把 PCR 直接设回原来的值。", C.orange, C.lightOrange);
  addStatCard(slide, 4.1, 2.55, 1.35, 1.4, "确定性", "同一输入序列总能得到同一结果。", C.green, C.lightGreen);
  slide.addText(
    "所以，PCR 不是“存文件内容”，而是“存平台状态的摘要链”。只要输入顺序、输入内容有任何改变，PCR 最终值都会跟着改变。",
    {
      x: 1.02,
      y: 4.35,
      w: 4.5,
      h: 1.05,
      fontFace: FONT.body,
      fontSize: 12.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  addCodePanel(
    slide,
    "代码映射：02_measurement.sh 的关键部分",
    `FILE_HASH=$(compute_sha256 config.txt)\ntpm2_pcrextend "10:sha256=\${FILE_HASH}"\nPCR_VALUE_FIRST=$(read_pcr_value 10)\n\nsed -i 's/ssh_port=22/ssh_port=2222/' config.txt\nTAMPERED_HASH=$(compute_sha256 config.txt)\ntpm2_pcrextend "10:sha256=\${TAMPERED_HASH}"`,
    "bash",
    6.1,
    1.42,
    6.42,
    2.45
  );
  addBulletList(
    slide,
    [
      "`compute_sha256` 负责把文件状态变成固定长度摘要。",
      "`tpm2_pcrextend` 不覆盖原值，而是把摘要扩展进 PCR 10。",
      "两次读取结果不同，正好印证了“篡改 -> 哈希变 -> PCR 变”的链式反应。",
    ],
    6.28,
    4.2,
    6.0,
    14
  );
  finalizeSlide(slide);
}

// Slide 10
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作四：03_seal_unseal.sh 如何把秘密绑定到平台状态", "脚本", 10, "有了度量之后，才能继续做“只有平台可信时才释放数据”。");
  addPanel(slide, 0.78, 1.35, 6.15, 5.6, C.panel, "实验主线");
  const flowItems = [
    "1. 先把配置文件哈希扩展到 PCR16，建立可信基线。",
    "2. 创建 Owner 层级 Primary Key，作为密封对象父对象。",
    "3. 创建基于 PCR16 当前值的 policy。",
    "4. 用 `tpm2_create` 把 secret.txt 密封成 TPM 对象。",
    "5. 正常状态下执行 `tpm2_unseal`，能得到原始秘密。",
    "6. 篡改 PCR16 后再次解封，TPM 会拒绝释放秘密。",
  ];
  addBulletList(slide, flowItems, 1.0, 1.82, 5.65, 14.5);
  addOutputBox(
    slide,
    "正常状态下的关键现象",
    `tpm2_unseal -c seal.ctx -p session:session.ctx\n\nMySecretKey-123456\n\n数据完整性验证通过：解封内容与原始内容完全一致`,
    7.1,
    1.42,
    5.45,
    2.05
  );
  addOutputBox(
    slide,
    "篡改后的关键现象",
    `tpm2_pcrextend 16:sha256=5db9512f...\nPCR 16 已被篡改\n\nERROR: Unable to run tpm2_unseal\n解封失败！TPM 拒绝释放数据`,
    7.1,
    3.75,
    5.45,
    2.15
  );
  addPanel(slide, 7.1, 5.96, 5.45, 0.96, C.lightOrange, "它对总目标的贡献");
  slide.addText(
    "03 脚本把 TPM 从“记录状态”升级成“基于状态做访问控制”。这正是保险箱场景的核心：不是谁拿到文件就能看，而是谁处于正确平台状态谁才能解封。",
    {
      x: 7.28,
      y: 6.4,
      w: 5.05,
      h: 0.34,
      fontFace: FONT.body,
      fontSize: 11.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  finalizeSlide(slide);
}

// Slide 11
{
  const slide = pptx.addSlide();
  addShell(slide, "理论与代码对应二：Policy、Primary 与 Unseal 到底对应什么", "理论", 11, "这一页要把大家最容易混淆的几个 TPM 对象讲清楚。");
  addCodePanel(
    slide,
    "代码片段：创建主密钥与策略",
    `tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx\n\ntpm2_pcrread -o pcr_current.bin sha256:16\ntpm2_startauthsession -S session.ctx\ntpm2_policypcr -S session.ctx -l sha256:16 -f pcr_current.bin -L pcr.policy`,
    "bash",
    0.78,
    1.42,
    6.05,
    2.35
  );
  addCodePanel(
    slide,
    "代码片段：密封、加载与解封",
    `tpm2_create -C primary.ctx -L pcr.policy -i secret.txt -u seal.pub -r seal.priv\ntpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx\n\ntpm2_startauthsession -S session.ctx --policy-session\ntpm2_policypcr -S session.ctx -l sha256:16\ntpm2_unseal -c seal.ctx -p session:session.ctx`,
    "bash",
    0.78,
    4.05,
    6.05,
    2.52
  );
  addPanel(slide, 7.05, 1.4, 5.52, 5.18, C.panel, "返回参数要怎么看");
  addBulletList(
    slide,
    [
      "`name-alg`：对象名称使用的摘要算法，本实验统一是 SHA-256。",
      "`attributes`：对象能力描述。Primary Key 会看到 `restricted|decrypt`，说明它主要承担父对象和解密保护角色。",
      "`type`：对象类型。密封对象不是 RSA，而是 `keyedhash` 类型。",
      "`authorization policy`：密封对象真正绑定的不是“某段文本”，而是 policy digest。",
      "`name`：对象名称。加载到 TPM 后，后续命令通过上下文文件或名称来引用它。",
      "脚本里的 `flush_all_contexts()` 很关键，因为 TPM 瞬态对象槽位很少，旧上下文不清掉，后续 `load` 容易失败。",
    ],
    7.28,
    1.84,
    5.0,
    13.5
  );
  finalizeSlide(slide);
}

// Slide 12
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作五：04_attestation.sh 如何完成远程证明", "脚本", 12, "到这一步，系统不只是“自保”，还可以向远程方证明自己当前可信。");
  addPanel(slide, 0.78, 1.35, 6.0, 5.6, C.panel, "Verifier / Attester 时序");
  slide.addShape(ShapeType.roundRect, {
    x: 1.0,
    y: 1.9,
    w: 1.8,
    h: 0.6,
    rectRadius: 0.04,
    line: { color: C.blue, pt: 1 },
    fill: { color: "EEF4FF" },
  });
  slide.addText("验证方 Verifier", {
    x: 1.12,
    y: 2.1,
    w: 1.55,
    h: 0.12,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.blue,
    align: "center",
    margin: 0,
  });
  slide.addShape(ShapeType.roundRect, {
    x: 4.15,
    y: 1.9,
    w: 1.8,
    h: 0.6,
    rectRadius: 0.04,
    line: { color: C.green, pt: 1 },
    fill: { color: C.lightGreen },
  });
  slide.addText("平台方 Attester", {
    x: 4.27,
    y: 2.1,
    w: 1.55,
    h: 0.12,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.green,
    align: "center",
    margin: 0,
  });
  slide.addShape(ShapeType.line, {
    x: 2.85,
    y: 2.2,
    w: 1.15,
    h: 0,
    line: { color: C.title, pt: 1.2, endArrowType: "triangle" },
  });
  slide.addText("Nonce", {
    x: 3.18,
    y: 2.0,
    w: 0.48,
    h: 0.12,
    fontFace: FONT.body,
    fontSize: 11,
    color: C.text,
    margin: 0,
  });
  slide.addShape(ShapeType.line, {
    x: 4.0,
    y: 3.06,
    w: -1.15,
    h: 0,
    line: { color: C.title, pt: 1.2, endArrowType: "triangle" },
  });
  slide.addText("Quote + Signature", {
    x: 3.0,
    y: 2.82,
    w: 0.95,
    h: 0.12,
    fontFace: FONT.body,
    fontSize: 11,
    color: C.text,
    margin: 0,
  });
  addBulletList(
    slide,
    [
      "先在 PCR0/1/2 写入 Bootloader、Kernel 和配置摘要。",
      "创建 EK，再基于 EK 创建 AK。",
      "验证方发送随机 Nonce。",
      "平台方用 AK 生成 Quote，并把 PCR、Nonce 和签名一起返回。",
      "验证方用 AK 公钥验证签名，同时检查 Nonce 是否匹配。",
    ],
    1.0,
    3.65,
    4.95,
    13.8
  );
  addOutputBox(
    slide,
    "实验输出：Quote 与验证结果",
    `Nonce: 0x4a71979d3988cba9dcfd9dc55c5253f6\nquote.msg: 129 字节\nquote.sig: 262 字节\nquote_pcr.bin: 668 字节\n\nQuote 验证成功\n错误 Nonce 验证失败`,
    7.02,
    1.42,
    5.55,
    2.65
  );
  addOutputBox(
    slide,
    "AK 公钥导出后，验证方看到什么",
    `attributes: ...|restricted|sign\nscheme: rsassa\nscheme-halg: sha256\n-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----`,
    7.02,
    4.35,
    5.55,
    2.35
  );
  finalizeSlide(slide);
}

// Slide 13
{
  const slide = pptx.addSlide();
  addShell(slide, "理论与代码对应三：EK、AK、Nonce、Quote 各自负责什么", "理论", 13, "远程证明最容易混的是四个名词，这一页逐个拆开。");
  addCodePanel(
    slide,
    "代码片段：创建 AK 与生成 Quote",
    `tpm2_createek -c ek.ctx -G rsa -u ek.pub\ntpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa -u ak.pub -n ak.name\nNONCE=$(openssl rand -hex 16)\ntpm2_quote -c ak.ctx -l sha256:0,1,2 -q "\${NONCE}" -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256`,
    "bash",
    0.78,
    1.4,
    6.05,
    2.65
  );
  addCodePanel(
    slide,
    "代码片段：验证 Quote",
    `tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q "\${NONCE}"\nWRONG_NONCE=$(openssl rand -hex 16)\ntpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q "\${WRONG_NONCE}"`,
    "bash",
    0.78,
    4.35,
    6.05,
    2.1
  );
  addPanel(slide, 7.08, 1.4, 5.48, 4.35, C.panel, "字段含义和安全意义");
  addBulletList(
    slide,
    [
      "EK：背书密钥，是 TPM 身份根，更多承担“身份证”角色。",
      "AK：证明密钥，真正负责对 Quote 签名，避免直接暴露 EK。",
      "Nonce：一次性随机挑战，解决“旧证明被重放”的问题。",
      "quoted：被签名的原始证明体，里面携带了 PCR 摘要和 Nonce。",
      "sig：AK 对 quoted 的签名结果，验证方检查的就是它。",
      "calcDigest：由被引用的 PCR 集合计算出来的摘要，用来证明状态确实被纳入签名。",
    ],
    7.3,
    1.85,
    5.0,
    13.2
  );
  addPanel(slide, 7.08, 5.96, 5.48, 0.9, C.lightRed, "实验现象");
  slide.addText(
    "同一份 Quote 在正确 Nonce 下验证通过，在错误 Nonce 下验证失败，说明“真实性”和“新鲜性”这两个目标都被满足了。",
    {
      x: 7.26,
      y: 6.36,
      w: 5.1,
      h: 0.26,
      fontFace: FONT.body,
      fontSize: 11.2,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  finalizeSlide(slide);
}

// Slide 14
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作六：05_pkcs11.sh 如何把 TPM 变成标准密码令牌", "脚本", 14, "这一页解释为什么这个项目不止是 TPM 命令演示，还能接入现有应用生态。");
  addPanel(slide, 0.78, 1.35, 5.3, 5.6, C.panel, "脚本完成的六件事");
  addBulletList(
    slide,
    [
      "自动进入私有 D-Bus 会话，确保 abrmd 和当前脚本在同一条 bus 上。",
      "启动 `tpm2-abrmd`，并切换 `TPM2TOOLS_TCTI` 与 `TPM2_PKCS11_TCTI`。",
      "执行 `tpm2_ptool init` 初始化 PKCS#11 store。",
      "执行 `addtoken` 创建 token，配置 SO PIN 与 User PIN。",
      "执行 `addkey` 在 TPM 中生成 RSA-2048 密钥对。",
      "用 `pkcs11-tool` 列对象、做签名，再导出公钥用 `openssl` 验证。",
    ],
    0.98,
    1.82,
    4.85,
    14.4
  );
  addOutputBox(
    slide,
    "实验输出：slots 与对象",
    `Slot 0 (0x1): tpm-vault-token\ntoken flags: login required, token initialized, PIN initialized\n\nPrivate Key Object; RSA\nUsage: decrypt, sign\nAccess: sensitive, never extractable\n\nPublic Key Object; RSA 2048 bits\nUsage: encrypt, verify`,
    6.3,
    1.42,
    6.25,
    2.85
  );
  addOutputBox(
    slide,
    "实验输出：签名与验签",
    `pkcs11-tool --sign ... -o signature.bin\n签名成功！(256 字节)\n\npkcs11-tool --read-object --type pubkey --id <CKA_ID>\nopenssl dgst -sha256 -verify pubkey.pem -signature signature.bin data_to_sign.txt\nVerified OK`,
    6.3,
    4.52,
    6.25,
    2.2
  );
  finalizeSlide(slide);
}

// Slide 15
{
  const slide = pptx.addSlide();
  addShell(slide, "理论与代码对应四：PKCS#11 的难点不在签名，而在资源管理", "理论", 15, "这一页重点讲本项目里最有工程含量的一段修复。");
  addStatCard(slide, 0.82, 1.42, 2.45, 1.6, "难点 1", "tpm2_ptool 单命令内部会占用多个 TPM 瞬态对象，直连 swtpm 时容易触发 0x902。", C.red, C.lightRed);
  addStatCard(slide, 3.5, 1.42, 2.45, 1.6, "难点 2", "abrmd 必须和脚本在同一条 D-Bus session 上，否则 tabrmd 虽然“看起来配置了”，其实连不上。", C.orange, C.lightOrange);
  addStatCard(slide, 6.18, 1.42, 2.45, 1.6, "难点 3", "公钥导出如果不按 `CKA_ID` 精确匹配，容易出现“签名成功但公钥没导对”的情况。", C.cyan, C.lightBlue);
  addCodePanel(
    slide,
    "关键修复代码：D-Bus 自举 + abrmd + CKA_ID 精确导出",
    `if [ -z "\${TPM_PKCS11_DBUS_BOOTSTRAPPED:-}" ]; then\n  export TPM_PKCS11_DBUS_BOOTSTRAPPED=1\n  exec dbus-run-session -- bash "$0" "$@"\nfi\n\ntpm2-abrmd --tcti="swtpm:host=localhost,port=\${TPM_SERVER_PORT}" --session &\nexport TPM2TOOLS_TCTI="tabrmd:bus_type=session"\n\nADDKEY_OUTPUT=$(tpm2_ptool addkey ... 2>&1)\nKEY_ID=$(echo "\${ADDKEY_OUTPUT}" | awk -F"'" '/CKA_ID:/ {print $2; exit}')\nREAD_PUB_CMD+=(--id "\${KEY_ID}")`,
    "bash",
    0.82,
    3.35,
    7.15,
    3.2
  );
  addPanel(slide, 8.2, 3.35, 4.35, 3.2, C.panel, "为什么这段代码重要");
  addBulletList(
    slide,
    [
      "它让脚本不再依赖“用户先手工进 dbus-run-session”，而是自带正确执行环境。",
      "它把“有 abrmd 进程”升级成“abrmd 真能被当前脚本访问”。",
      "它保证签名与导出的公钥来自同一对象，最终得到 `Verified OK` 的稳定结果。",
    ],
    8.4,
    3.82,
    3.9,
    13
  );
  finalizeSlide(slide);
}

// Slide 16
{
  const slide = pptx.addSlide();
  addShell(slide, "相关工作七：06_full_demo 与 99_cleanup 如何形成业务闭环", "脚本", 16, "前面是单项实验，这里开始把它们串成完整故事。");
  addPanel(slide, 0.78, 1.35, 12.0, 2.0, C.panel, "完整演示脚本做了什么");
  const chainX = [0.98, 3.32, 5.66, 8.0, 10.34];
  const chainLabels = [
    ["1. 度量", C.cyan],
    ["2. 密封", C.orange],
    ["3. 证明", C.green],
    ["4. 解封", C.blue],
    ["5. 攻击失败", C.red],
  ];
  chainLabels.forEach((item, idx) => {
    addFlowArrow(slide, chainX[idx], 2.0, 1.85, 0.58, item[0], item[1]);
  });
  slide.addText(
    "06 脚本负责把前面分散的 TPM 能力拼成一个有业务语义的系统：平台先建立可信基线，再密封秘密，远程管理员验证平台可信，随后才允许解封；一旦平台被篡改，解封立即失败。",
    {
      x: 0.98,
      y: 2.7,
      w: 11.4,
      h: 0.35,
      fontFace: FONT.body,
      fontSize: 12.5,
      color: C.text,
      align: "center",
      margin: 0,
    }
  );
  addPanel(slide, 0.78, 3.75, 5.8, 2.9, C.lightBlue, "06_full_demo 的价值");
  addBulletList(
    slide,
    [
      "把“脚本功能”升级成“系统流程”，更适合答辩展示。",
      "证明四项能力不是孤立存在，而是能组合成一条可信链。",
      "输出中既有正常解封，也有攻击失败，实验对比非常清楚。",
    ],
    1.0,
    4.18,
    5.35,
    13.6
  );
  addPanel(slide, 6.82, 3.75, 5.96, 2.9, C.lightOrange, "99_cleanup 的价值");
  addBulletList(
    slide,
    [
      "停止 `swtpm`，删除状态目录和工作目录，让实验回到干净初态。",
      "避免上一次实验残留对象影响本次结果，提高可重复性。",
      "实验记录里也验证了：清理后如果直接运行 06，会提示 TPM 未运行，说明环境检查逻辑有效。",
    ],
    7.05,
    4.18,
    5.45,
    13.6
  );
  finalizeSlide(slide);
}

// Slide 17
{
  const slide = pptx.addSlide();
  addShell(slide, "公共关键代码：统一配置、环境检查与上下文清理", "代码", 17, "答辩里不能只讲业务脚本，还要讲这些让系统稳定运行的基础层。");
  addCodePanel(
    slide,
    "config/tpm_env.conf：统一配置",
    `TPM_SERVER_PORT=2321\nTPM_CTRL_PORT=2322\nTPM_STATE_DIR="/tmp/tpm-vault-state"\nexport TPM2TOOLS_TCTI="swtpm:host=localhost,port=\${TPM_SERVER_PORT}"\nexport TPM2_PKCS11_TCTI="tabrmd:bus_type=session"\nexport TPM2_PKCS11_STORE="\${TPM_WORK_DIR}/pkcs11-store"`,
    "bash",
    0.78,
    1.4,
    6.0,
    2.3
  );
  addCodePanel(
    slide,
    "tpm_helpers.sh：公共能力",
    `check_environment() {\n  check_tpm2_tools\n  check_tpm_running\n  tpm2_pcrread sha256:0\n}\n\nflush_all_contexts() {\n  tpm2_flushcontext -t 2>/dev/null || true\n  tpm2_flushcontext -l 2>/dev/null || true\n  tpm2_flushcontext -s 2>/dev/null || true\n}`,
    "bash",
    0.78,
    4.02,
    6.0,
    2.55
  );
  addPanel(slide, 7.02, 1.4, 5.55, 5.15, C.panel, "为什么这部分非常关键");
  addBulletList(
    slide,
    [
      "统一配置让所有脚本共享同一端口、同一状态目录、同一 TCTI，避免“每个脚本写一套”的维护问题。",
      "环境检查让失败尽量发生在实验一开始，而不是做到一半才发现 TPM 根本没连上。",
      "上下文清理解决的是 TPM 资源非常少这个现实限制，尤其对 `create / load / quote / pkcs11` 这样的命令非常重要。",
      "从工程角度看，这一层就是项目稳定性的保障层。它不炫技，但最能决定实验能否复现。",
    ],
    7.25,
    1.92,
    5.05,
    13.5
  );
  finalizeSlide(slide);
}

// Slide 18
{
  const slide = pptx.addSlide();
  addShell(slide, "实验效果演示一：单项实验的关键结果", "效果", 18, "这一页不再讲原理，只看最后跑出来了什么。");
  addStatCard(
    slide,
    0.82,
    1.4,
    5.75,
    2.35,
    "Measurement：PCR 10 成功反映篡改",
    "初始值为全零；第一次扩展后变为 0x85CC...；文件被改动后再次扩展，变为 0x2CD1...。这说明 PCR 记录的是“摘要链”，不是简单覆盖值。",
    C.cyan,
    C.lightBlue
  );
  addStatCard(
    slide,
    6.75,
    1.4,
    5.75,
    2.35,
    "Seal / Unseal：正常解封、篡改拒绝",
    "正常状态下返回 MySecretKey-123456；篡改 PCR 16 后，`tpm2_unseal` 直接失败。说明 TPM 成功把秘密和平台状态绑定起来。",
    C.orange,
    C.lightOrange
  );
  addStatCard(
    slide,
    0.82,
    4.05,
    5.75,
    2.35,
    "Attestation：正确 Nonce 通过，错误 Nonce 失败",
    "Quote 生成后，正确 Nonce 验证成功；把 Nonce 换成另一个随机值后验证失败。这证明远程证明具备防重放能力。",
    C.green,
    C.lightGreen
  );
  addStatCard(
    slide,
    6.75,
    4.05,
    5.75,
    2.35,
    "PKCS#11：标准工具链签名与验签成功",
    "Slot 与对象可见，私钥不可导出，签名结果为 256 字节，最终 `Verified OK`。说明 TPM 已能被标准密码学工具直接使用。",
    C.red,
    C.lightRed
  );
  finalizeSlide(slide);
}

// Slide 19
{
  const slide = pptx.addSlide();
  addShell(slide, "实验效果演示二：完整业务流程与攻击阻止", "效果", 19, "这页展示最终系统级效果：可信时能开箱，不可信时打不开。");
  addPanel(slide, 0.82, 1.42, 5.9, 5.3, C.lightGreen, "可信状态：系统允许解封");
  slide.addText("06_full_demo 的关键输出", {
    x: 1.02,
    y: 1.7,
    w: 5.45,
    h: 0.14,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.green,
    margin: 0,
  });
  slide.addText(
    `PCR 0/16 已建立可信基线\n远程证明验证通过\n解封结果：MyVaultSecret-1234\n\n这说明系统在“可信平台 + 证明通过”的前提下，能够顺利释放业务秘密。`,
    {
      x: 1.02,
      y: 2.05,
      w: 5.3,
      h: 3.8,
      fontFace: FONT.body,
      fontSize: 13,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  addPanel(slide, 6.95, 1.42, 5.55, 5.3, C.lightRed, "篡改状态：系统拒绝解封");
  slide.addText("攻击模拟的关键输出", {
    x: 7.15,
    y: 1.7,
    w: 5.1,
    h: 0.14,
    fontFace: FONT.head,
    fontSize: 15,
    bold: true,
    color: C.red,
    margin: 0,
  });
  slide.addText(
    `攻击者向 PCR 16 扩展 MALWARE_INJECTED 摘要\n重新创建主密钥并尝试解封\nTPM 返回：解封被拒绝，攻击被阻止\n\n这说明攻击者即使获得系统访问权，也无法在错误平台状态下取出秘密。`,
    {
      x: 7.15,
      y: 2.05,
      w: 4.95,
      h: 3.8,
      fontFace: FONT.body,
      fontSize: 13,
      color: C.text,
      margin: 0,
      valign: "mid",
    }
  );
  slide.addShape(ShapeType.line, {
    x: 6.72,
    y: 1.62,
    w: 0,
    h: 4.9,
    line: { color: C.border, pt: 1.2, dash: "dash" },
  });
  finalizeSlide(slide);
}

// Slide 20
{
  const slide = pptx.addSlide();
  addShell(slide, "安全分析、局限与总结", "收束", 20, "最后收束成一句话：这个系统为什么成立，又有哪些边界。");
  addPanel(slide, 0.82, 1.42, 5.9, 4.95, C.panel, "安全收益");
  addBulletList(
    slide,
    [
      "完整性：PCR 能把关键组件状态浓缩成可验证摘要。",
      "机密性：密封对象绑定 PCR，秘密不是“拿到文件就能看”。",
      "真实性：Quote 由 AK 私钥签名，验证方能确认状态来自 TPM。",
      "抗重放：Nonce 让旧的证明结果无法直接重复使用。",
      "可复用性：PKCS#11 让 TPM 进入标准应用生态，而不是停留在命令行实验。",
    ],
    1.02,
    1.92,
    5.35,
    13.7
  );
  addPanel(slide, 6.95, 1.42, 5.55, 4.95, C.panel, "局限与改进方向");
  addBulletList(
    slide,
    [
      "本项目使用的是 `swtpm` 软件模拟器，不等于真实硬件 TPM 的物理安全级别。",
      "EK 证书链在实验中被简化；真实部署应补全厂商证书验证链。",
      "演示用 PIN 为固定值，只适合教学，生产环境要使用强口令和更完善的密钥生命周期管理。",
      "后续可继续扩展：接入真实 TPM、加入 FAPI、与 LUKS 或浏览器证书场景联动。",
    ],
    7.15,
    1.92,
    5.05,
    13.7
  );
  slide.addShape(ShapeType.roundRect, {
    x: 0.82,
    y: 6.62,
    w: 11.68,
    h: 0.42,
    rectRadius: 0.04,
    line: { color: C.navy, pt: 0 },
    fill: { color: C.navy },
  });
  slide.addText(
    "总结：本项目把 TPM 的四项核心能力从“概念”变成了“可复现、可讲解、可演示”的完整系统流程。",
    {
      x: 1.05,
      y: 6.76,
      w: 10.95,
      h: 0.12,
      fontFace: FONT.head,
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    }
  );
  finalizeSlide(slide);
}

async function main() {
  const outPath = path.join(__dirname, "tpm_course_design_30min.pptx");
  await pptx.writeFile({ fileName: outPath });
  // eslint-disable-next-line no-console
  console.log(`PPT generated: ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
