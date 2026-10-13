import { File, Paths } from 'expo-file-system/next';
import { AnniversaryLetterContent, getAnniversaryLetter } from './anniversary';

let shownThisLaunch = false;

export async function getLaunchAnniversaryLetter(date = new Date()): Promise<AnniversaryLetterContent | null> {
  if (shownThisLaunch || !getAnniversaryLetter(date, 0)) return null;
  shownThisLaunch = true;

  const stateFile = new File(Paths.document, 'anniversary-letter-index.txt');
  let index = 0;
  try {
    if (stateFile.exists) index = Number(await stateFile.text());
  } catch {
    // A damaged index must not prevent the greeting or the home screen.
  }

  const letter = getAnniversaryLetter(date, index)!;
  try {
    if (!stateFile.exists) stateFile.create();
    stateFile.write(String(letter.nextIndex));
  } catch {
    // The greeting still works when local persistence is unavailable.
  }
  return letter;
}
