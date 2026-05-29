// three ships no bundled types and we don't depend on @types/three.
// Treat it as `any` so TS-authored components (LaserFlow) can import it.
declare module "three";
