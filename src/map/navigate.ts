/**
 * Arrow-key movement lives in `shared/navigate.ts` since Plan 21, because the kitchen proves each
 * published bubble layout reachable with the same rule the site navigates by. Re-exported here so
 * the site's own imports and tests keep their address.
 */
export * from '../../shared/navigate'
