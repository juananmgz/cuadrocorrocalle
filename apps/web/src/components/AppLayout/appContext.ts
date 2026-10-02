import type { Group } from '@cuadrocorrocalle/shared';
import { useOutletContext } from 'react-router';

export interface AppContext {
  activeGroup?: Group;
  signOut: () => Promise<void>;
}

/** Data shared by every signed-in page, provided by AppLayout. */
export const useApp = () => useOutletContext<AppContext>();
