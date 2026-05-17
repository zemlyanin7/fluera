import React from 'react';
import { Path, Circle, Rect } from 'react-native-svg';
import { Icon, type IconProps } from './Icon';
import { PATHS } from './paths';

const P = (d: string) => <Path d={d} />;

export const IcChevronLeft  = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronLeft!)}</Icon>;
export const IcChevronRight = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronRight!)}</Icon>;
export const IcChevronDown  = (p: IconProps) => <Icon {...p}>{P(PATHS.chevronDown!)}</Icon>;
export const IcClose = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.closeP1!)}{P(PATHS.closeP2!)}</Icon>
);
export const IcSearch = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={11} cy={11} r={7} />
    {P(PATHS.searchPath!)}
  </Icon>
);
export const IcPlus = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.plusP1!)}{P(PATHS.plusP2!)}</Icon>
);
export const IcBook = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.bookP1!)}{P(PATHS.bookP2!)}</Icon>
);
export const IcLibrary = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={4} width={6} height={16} rx={1.5} />
    <Rect x={11} y={4} width={4} height={16} rx={1.5} />
    {P(PATHS.libraryP1!)}
  </Icon>
);
export const IcSparkle = (p: IconProps) => <Icon {...p}>{P(PATHS.sparkle!)}</Icon>;
export const IcFlame   = (p: IconProps) => <Icon {...p}>{P(PATHS.flame!)}</Icon>;
export const IcGraph = (p: IconProps) => (
  <Icon {...p}>
    {P(PATHS.graphP1!)}{P(PATHS.graphP2!)}{P(PATHS.graphP3!)}
    {P(PATHS.graphP4!)}{P(PATHS.graphP5!)}
  </Icon>
);
export const IcCards = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={6} width={13} height={14} rx={2} />
    {P(PATHS.cardsP1!)}
  </Icon>
);
export const IcPlay = (p: IconProps) => (
  <Icon {...p} fill={p.color}>
    <Path d={PATHS.play!} stroke="none" fill={p.color} />
  </Icon>
);
export const IcVolume = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.volumeP1!)}{P(PATHS.volumeP2!)}</Icon>
);
export const IcBookmark = (p: IconProps) => <Icon {...p}>{P(PATHS.bookmark!)}</Icon>;
export const IcStar     = (p: IconProps) => <Icon {...p}>{P(PATHS.star!)}</Icon>;
export const IcHeart    = (p: IconProps) => <Icon {...p}>{P(PATHS.heart!)}</Icon>;
export const IcCheck    = (p: IconProps) => <Icon {...p}>{P(PATHS.check!)}</Icon>;
export const IcArrowRight = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.arrowRightP1!)}{P(PATHS.arrowRightP2!)}</Icon>
);
export const IcGlobe = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={9} />
    {P(PATHS.globeP1!)}{P(PATHS.globeP2!)}{P(PATHS.globeP3!)}
  </Icon>
);
export const IcFontSize = (p: IconProps) => (
  <Icon {...p}>
    {P(PATHS.fontSizeP1!)}{P(PATHS.fontSizeP2!)}
    {P(PATHS.fontSizeP3!)}{P(PATHS.fontSizeP4!)}
  </Icon>
);
export const IcMoon = (p: IconProps) => <Icon {...p}>{P(PATHS.moon!)}</Icon>;
export const IcMore = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={5}  cy={12} r={1.2} fill={p.color} />
    <Circle cx={12} cy={12} r={1.2} fill={p.color} />
    <Circle cx={19} cy={12} r={1.2} fill={p.color} />
  </Icon>
);
export const IcLayers = (p: IconProps) => (
  <Icon {...p}>{P(PATHS.layersP1!)}{P(PATHS.layersP2!)}{P(PATHS.layersP3!)}</Icon>
);
export const IcSettings = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={3} />
    {P(PATHS.settingsGear!)}
  </Icon>
);

export type { IconProps };
