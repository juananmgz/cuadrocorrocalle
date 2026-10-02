import type { Group } from '@cuadrocorrocalle/shared';
import { useOutletContext } from 'react-router';

export interface AppContext {
  activeGroup?: Group;
  signOut: () => Promise<void>;
  /** Width in px a page covers on the left; the grid centres on the space to its right. */
  setGridInset: (width: number) => void;
}

/** Data shared by every signed-in page, provided by AppLayout. */
export const useApp = () => useOutletContext<AppContext>();
