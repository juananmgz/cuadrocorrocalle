import type { Group } from '@cuadrocorrocalle/shared';
import { useOutletContext } from 'react-router';

import type { GridStage } from '../GridBackground/GridBackground';

export interface GridSettings {
  leftInset?: number;
  view?: 'perspective' | 'angled' | 'top';
  stage?: GridStage | null;
  showCross?: boolean;
  label?: string | null;
}

export interface AppContext {
  activeGroup?: Group;
  signOut: () => Promise<void>;
  /** Lets a page move the background grid: left inset, view from above and stage preview. */
  setGrid: (grid: GridSettings) => void;
  /** The middle of the top bar, where a page can put its title (through a portal). */
  titleSlot: HTMLElement | null;
}

/** Data shared by every signed-in page, provided by AppLayout. */
export const useApp = () => useOutletContext<AppContext>();
