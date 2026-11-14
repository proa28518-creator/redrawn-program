// Burned-in Arabic captions for "Otis" (AGY_BRIEF.md Rule 3):
// - 1–3 words at a time from word_timestamps_team.txt, governed by script_locked.txt wording.
// - Lower third (top 72%), bold white (#ffffff) with thick black outline.
// - No on-screen title card; shot 1 frame 0 is action already in progress.

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export type CaptionPhrase = { text: string; a: number; b: number; shot: number; top?: number };
export const CAPTION_TOP_DEFAULT = 72;

export const CAPTIONS: CaptionPhrase[] = [
  // Shot 01 (0..42): وقف فوق منصة مفتوحة
  { text: "وقف فوق", a: 0, b: 20, shot: 1 },
  { text: "منصة مفتوحة", a: 20, b: 42, shot: 1 },
  // Shot 02 (42..85): على ارتفاع تلات أدوار،
  { text: "على ارتفاع", a: 42, b: 60, shot: 2 },
  { text: "تلات أدوار،", a: 60, b: 85, shot: 2 },
  // Shot 03 (85..151): وشاور لمساعده يقطع الحبل بالفأس!
  { text: "وشاور لمساعده", a: 85, b: 105, shot: 3 },
  { text: "يقطع الحبل بالفأس!", a: 105, b: 151, shot: 3 },
  // Shot 04 (151..210): زمان كانت كلمة مصعد معناها
  { text: "زمان كانت", a: 151, b: 170, shot: 4 },
  { text: "كلمة مصعد معناها", a: 170, b: 210, shot: 4 },
  // Shot 05 (210..260): الموت؛ أي حبل يتقطع، الصندوق ينزل
  { text: "الموت؛", a: 210, b: 215, shot: 5 },
  { text: "أي حبل يتقطع،", a: 215, b: 240, shot: 5 },
  { text: "الصندوق ينزل", a: 240, b: 260, shot: 5 },
  // Shot 06 (260..310): يطحن اللي جواه. عشان كده
  { text: "يطحن اللي جواه.", a: 260, b: 300, shot: 6 },
  { text: "عشان كده", a: 300, b: 310, shot: 6 },
  // Shot 07 (310..360): الأغنياء سكنوا الدور الأرضي،
  { text: "الأغنياء سكنوا", a: 310, b: 332, shot: 7 },
  { text: "الدور الأرضي،", a: 332, b: 360, shot: 7 },
  // Shot 08 (360..399): والفقراء طلعوا السلم.
  { text: "والفقراء طلعوا السلم.", a: 360, b: 390, shot: 8 },
  { text: "إليشا", a: 390, b: 399, shot: 8 },
  // Shot 09 (399..451): إليشا أوتيس اخترع فرامل أمان،
  { text: "إليشا أوتيس اخترع", a: 399, b: 422, shot: 9 },
  { text: "فرامل أمان،", a: 422, b: 451, shot: 9 },
  // Shot 10 (451..499): بس التجار ضحكوا عليه:
  { text: "بس التجار", a: 451, b: 465, shot: 10, top: 75 },
  { text: "ضحكوا عليه:", a: 465, b: 493, shot: 10, top: 75 },
  { text: "مين", a: 493, b: 499, shot: 10, top: 75 },
  // Shot 11 (499..569): مين هيركب علبة متعلقة في فتلة؟
  { text: "مين هيركب علبة", a: 499, b: 520, shot: 11 },
  { text: "متعلقة في فتلة؟", a: 520, b: 569, shot: 11 },
  // Shot 12 (569..643): فقرر يعمل عرض حي في معرض نيويورك.
  { text: "فقرر يعمل", a: 569, b: 595, shot: 12 },
  { text: "عرض حي في", a: 595, b: 615, shot: 12 },
  { text: "معرض نيويورك.", a: 615, b: 643, shot: 12 },
  // Shot 13 (643..690): طلع المنصة قدام آلاف المتفرجين،
  { text: "طلع المنصة", a: 643, b: 660, shot: 13 },
  { text: "قدام آلاف المتفرجين،", a: 660, b: 690, shot: 13 },
  // Shot 14 (690..729): والمساعد رفع الفأس
  { text: "والمساعد رفع الفأس", a: 690, b: 729, shot: 14 },
  // Shot 15 (729..756): ونزل على الحبل،
  { text: "ونزل على الحبل،", a: 729, b: 756, shot: 15 },
  // Shot 16 (756..792): طاخ!
  { text: "طاخ!", a: 756, b: 792, shot: 16 },
  // Shot 17 (792..820): الحبل اتقطع،
  { text: "الحبل اتقطع،", a: 792, b: 820, shot: 17 },
  // Shot 18 (820..869): والمنصة هبدت لتحت كام سنتي،
  { text: "والمنصة هبدت لتحت", a: 820, b: 848, shot: 18 },
  { text: "كام سنتي،", a: 848, b: 869, shot: 18 },
  // Shot 19 (869..930): والجمهور صرخ من الرعب!
  { text: "والجمهور صرخ", a: 869, b: 889, shot: 19 },
  { text: "من الرعب!", a: 889, b: 930, shot: 19 },
  // Shot 20 (930..990): بس في ثانية المنصة اتسمّرت في الهوا!
  { text: "بس في ثانية", a: 930, b: 956, shot: 20 },
  { text: "المنصة اتسمّرت", a: 956, b: 978, shot: 20 },
  { text: "في الهوا!", a: 978, b: 990, shot: 20 },
  // Shot 21 (990..1049): أوتيس عدّل برنيطته وقال ببرود:
  { text: "أوتيس عدّل برنيطته", a: 990, b: 1025, shot: 21, top: 75 },
  { text: "وقال ببرود:", a: 1025, b: 1049, shot: 21, top: 75 },
  // Shot 22 (1049..1120): كل شيء تمام يا سادة، كله آمن!
  { text: "كل شيء تمام", a: 1049, b: 1076, shot: 22 },
  { text: "يا سادة،", a: 1076, b: 1098, shot: 22 },
  { text: "كله آمن!", a: 1098, b: 1120, shot: 22 },
  // Shot 23 (1120..1160): شوف يا سيدي،
  { text: "شوف يا سيدي،", a: 1120, b: 1160, shot: 23 },
  // Shot 24 (1160..1230): سقف المنصة فيه سوستة حديد مشدودة بوزن الحبل.
  { text: "سقف المنصة فيه", a: 1160, b: 1184, shot: 24 },
  { text: "سوستة حديد مشدودة", a: 1184, b: 1208, shot: 24 },
  { text: "بوزن الحبل.", a: 1208, b: 1230, shot: 24 },
  // Shot 25 (1230..1281): طول ما الحبل سليم السوستة مضغوطة
  { text: "طول ما الحبل", a: 1230, b: 1252, shot: 25 },
  { text: "سليم السوستة مضغوطة", a: 1252, b: 1281, shot: 25 },
  // Shot 26 (1281..1320): والكلابات بعيدة،
  { text: "والكلابات بعيدة،", a: 1281, b: 1320, shot: 26 },
  // Shot 27 (1320..1363): وأول ما الحبل يتقطع
  { text: "وأول ما الحبل", a: 1320, b: 1350, shot: 27 },
  { text: "يتقطع", a: 1350, b: 1363, shot: 27 },
  // Shot 28 (1363..1406): السوستة تفرد وتغرز الكلابات
  { text: "السوستة تفرد", a: 1363, b: 1380, shot: 28 },
  { text: "وتغرز الكلابات", a: 1380, b: 1406, shot: 28 },
  // Shot 29 (1406..1456): في سنون السكة فتفرمل فوراً،
  { text: "في سنون السكة", a: 1406, b: 1427, shot: 29 },
  { text: "فتفرمل فوراً،", a: 1427, b: 1456, shot: 29 },
  // Shot 30 (1456..1500): زي قفل حزام الأمان!
  { text: "زي قفل", a: 1456, b: 1470, shot: 30 },
  { text: "حزام الأمان!", a: 1470, b: 1500, shot: 30 },
  // Shot 31 (1500..1546): ومن يومها الطوابق العالية
  { text: "ومن يومها", a: 1500, b: 1512, shot: 31 },
  { text: "الطوابق العالية", a: 1512, b: 1546, shot: 31 },
  // Shot 32 (1546..1579): بقت أغلى شقق،
  { text: "بقت أغلى شقق،", a: 1546, b: 1579, shot: 32 },
  // Shot 33 (1579..1620): وناطحات السحاب
  { text: "وناطحات السحاب", a: 1579, b: 1620, shot: 33 },
  // Shot 34 (1620..1664): اتولدت!
  { text: "اتولدت!", a: 1620, b: 1664, shot: 34 },
];

export function captionAt(f: number): CaptionPhrase | null {
  for (const c of CAPTIONS) if (f >= c.a && f < c.b) return c;
  return null;
}

const CAPTION_SHADOW =
  "5px 0 0 #000, -5px 0 0 #000, 0 5px 0 #000, 0 -5px 0 #000, " +
  "4px 4px 0 #000, -4px 4px 0 #000, 4px -4px 0 #000, -4px -4px 0 #000, " +
  "0 8px 18px rgba(0,0,0,0.65)";

export const CaptionsOverlay: React.FC = () => {
  const f = useCurrentFrame();
  const cap = captionAt(f);
  if (!cap) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        dir="rtl"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${cap.top ?? CAPTION_TOP_DEFAULT}%`,
          transform: "translateY(-50%)",
          textAlign: "center",
          padding: "0 6%",
          fontFamily: "'Noto Kufi Arabic', 'Noto Sans Arabic', 'DejaVu Sans', sans-serif",
          fontWeight: 900,
          fontSize: 82,
          lineHeight: 1.2,
          color: "#ffffff",
          WebkitTextStroke: "3px #000000",
          paintOrder: "stroke fill",
          textShadow: CAPTION_SHADOW,
        }}
      >
        {cap.text}
      </div>
    </AbsoluteFill>
  );
};
