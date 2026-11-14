// index.ts — The documentation tree, in reading order.
//
// The sidebar, the previous/next cards and the search index all derive from this
// one list, so adding a page is a matter of writing it and adding it to its group.
import type { DocGroup } from './types';
import { GETTING_STARTED } from './pages/gettingStarted';
import { UTILS } from './pages/utils';
import { STRATEGY } from './pages/strategy';
import { ENGINE } from './pages/engine';
import { DATA } from './pages/data';
import { FILLS } from './pages/fills';
import { RESULTS } from './pages/results';
import { EXAMPLES } from './pages/examples';
import { HELP } from './pages/help';

export const VERSION = 'v2.0';

export const DOCS_GROUPS: DocGroup[] = [
  GETTING_STARTED,
  UTILS,
  STRATEGY,
  ENGINE,
  DATA,
  FILLS,
  RESULTS,
  EXAMPLES,
  HELP,
];
