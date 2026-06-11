/**
 * Component registry — single source of truth for the AI.
 * Add a component:
 *   1. Drop the file under components/<category>/<Name>.jsx
 *   2. Import + add a line below
 * No other changes needed.
 */

// --- text
import { TextReveal }      from './text/TextReveal';
import { WordReveal }      from './text/WordReveal';
import { TypewriterText }  from './text/TypewriterText';
import { GradientText }    from './text/GradientText';
import { CounterText }     from './text/CounterText';

// --- ui
import { MouseCursor }     from './ui/MouseCursor';
import { ButtonClick }     from './ui/ButtonClick';
import { TypingInput }     from './ui/TypingInput';
import { BrowserWindow }   from './ui/BrowserWindow';
import { PhoneMockup }     from './ui/PhoneMockup';

// --- product
import { FeatureCard }     from './product/FeatureCard';
import { PricingCard }     from './product/PricingCard';
import { TestimonialCard } from './product/TestimonialCard';
import { StatsCounter }    from './product/StatsCounter';
import { LogoWall }        from './product/LogoWall';

// --- motion
import { GradientBlob }    from './motion/GradientBlob';
import { LightSweep }      from './motion/LightSweep';
import { ParticleField }   from './motion/ParticleField';
import { GlowRing }        from './motion/GlowRing';
import { ConfettiBurst }   from './motion/ConfettiBurst';

// --- media
import { ImageScene }      from './media/ImageScene';
import { ZoomPanImage }    from './media/ZoomPanImage';
import { LogoIntro }       from './media/LogoIntro';

// --- travel
import { MapRoute }        from './travel/MapRoute';
import { LocationPin }     from './travel/LocationPin';
import { BoardingPass }    from './travel/BoardingPass';

// --- ecommerce
import { ProductCard }     from './ecommerce/ProductCard';
import { PriceTag }        from './ecommerce/PriceTag';
import { ReviewStars }     from './ecommerce/ReviewStars';

// --- social
import { InstagramPostMockup } from './social/InstagramPostMockup';
import { LikeCounter }         from './social/LikeCounter';
import { CommentBubble }       from './social/CommentBubble';

// --- tech
import { ChatBubble }       from './tech/ChatBubble';
import { AIThinkingDots }   from './tech/AIThinkingDots';
import { VoiceWaveform }    from './tech/VoiceWaveform';
import { CodeBlockReveal }  from './tech/CodeBlockReveal';

// --- transitions
import { FadeTransition }   from './transitions/FadeTransition';
import { SlideTransition }  from './transitions/SlideTransition';
import { WipeTransition }   from './transitions/WipeTransition';
import { GlitchTransition } from './transitions/GlitchTransition';

export const REGISTRY = {
  // text
  TextReveal, WordReveal, TypewriterText, GradientText, CounterText,
  // ui
  MouseCursor, ButtonClick, TypingInput, BrowserWindow, PhoneMockup,
  // product
  FeatureCard, PricingCard, TestimonialCard, StatsCounter, LogoWall,
  // motion
  GradientBlob, LightSweep, ParticleField, GlowRing, ConfettiBurst,
  // media
  ImageScene, ZoomPanImage, LogoIntro,
  // travel
  MapRoute, LocationPin, BoardingPass,
  // ecommerce
  ProductCard, PriceTag, ReviewStars,
  // social
  InstagramPostMockup, LikeCounter, CommentBubble,
  // tech
  ChatBubble, AIThinkingDots, VoiceWaveform, CodeBlockReveal,
  // transitions
  FadeTransition, SlideTransition, WipeTransition, GlitchTransition,
};

export function resolveComponent(name) {
  return REGISTRY[name] || null;
}

export function listComponents() {
  return Object.keys(REGISTRY).sort();
}

export {
  TextReveal,
  WordReveal,
  TypewriterText,
  GradientText,
  CounterText,
  MouseCursor,
  ButtonClick,
  TypingInput,
  BrowserWindow,
  PhoneMockup,
  FeatureCard,
  PricingCard,
  TestimonialCard,
  StatsCounter,
  LogoWall,
  GradientBlob,
  LightSweep,
  ParticleField,
  GlowRing,
  ConfettiBurst,
  ImageScene,
  ZoomPanImage,
  LogoIntro,
  MapRoute,
  LocationPin,
  BoardingPass,
  ProductCard,
  PriceTag,
  ReviewStars,
  InstagramPostMockup,
  LikeCounter,
  CommentBubble,
  ChatBubble,
  AIThinkingDots,
  VoiceWaveform,
  CodeBlockReveal,
  FadeTransition,
  SlideTransition,
  WipeTransition,
  GlitchTransition,
};
