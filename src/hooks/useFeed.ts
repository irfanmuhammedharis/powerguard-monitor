import { feedStore, type FeedState } from '../core/deviceFeed';
import { useStore } from '../store/createStore';

/** Select primitives (or stable references) so only changed fields re-render. */
export const useFeed = <S>(selector: (s: FeedState) => S): S =>
  useStore(feedStore, selector);
