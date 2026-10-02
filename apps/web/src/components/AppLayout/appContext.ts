import type { Group } from '@cuadrocorrocalle/shared';
import { useOutletContext } from 'react-router';

import type { GridStage } from '../GridBackground/GridBackground';

export interface GridSettings {
  leftInset?: number;
  view?: 'perspective' | 'top';
  stage?: GridStage | null;
  showCross?: boolean;
}

export interface AppContext {
  activeGroup?: Group;
  signOut: () => Promise<void>;
  /** Lets a page move the background grid: left inset, view from above and stage preview. */
  setGrid: (grid: GridSettings) => void;
}

/** Data shared by every signed-in page, provided by AppLayout. */
export const useApp = () => useOutletContext<AppContext>();
