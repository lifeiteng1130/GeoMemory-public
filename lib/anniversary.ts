export interface AnniversaryLetterContent {
  heading: string;
  message: string;
  nextIndex: number;
}

const MESSAGES = [
  '宝宝，又到了这一天。时间往前走了很远，回头看，最庆幸的还是一路有你。',
  '宝宝，和你在一起以后，许多平常的日子都有了值得记住的理由。今天尤其如此。',
  '宝宝，我不太擅长把喜欢说得动听。但过去这一年里，每次想到以后，画面里都有你。',
  '宝宝，日子有晴有雨，还好我们一直并肩走着。往后的路，也想和你慢慢走。',
  '宝宝，纪念日像一个小小的书签。翻到这里，发现我们又一起写下了许多故事。',
  '宝宝，如果要说今天有什么特别，大概是它提醒我：遇见你这件事，至今仍让我觉得幸运。',
];

export function getAnniversaryLetter(date: Date, openingIndex: number): AnniversaryLetterContent | null {
  if (date.getMonth() !== 9) return null;
  const headings: Record<number, string> = { 11: '回望', 12: '此刻', 13: '以后' };
  const heading = headings[date.getDate()];
  if (!heading) return null;
  const index = Number.isSafeInteger(openingIndex) && openingIndex >= 0 ? openingIndex % MESSAGES.length : 0;
  return { heading, message: MESSAGES[index], nextIndex: (index + 1) % MESSAGES.length };
}
