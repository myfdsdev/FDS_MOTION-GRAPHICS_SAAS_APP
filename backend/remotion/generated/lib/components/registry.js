/**
 * Component registry — single source of truth for the AI.
 * Add a component:
 *   1. Drop the file under components/<category>/<Name>.jsx
 *   2. Import + add a line below
 * No other changes needed.
 */

// --- text
import { TextReveal }      from './text/TextReveal.jsx';
import { WordReveal }      from './text/WordReveal.jsx';
import { TypewriterText }  from './text/TypewriterText.jsx';
import { GradientText }    from './text/GradientText.jsx';
import { CounterText }     from './text/CounterText.jsx';

// --- ui
import { MouseCursor }     from './ui/MouseCursor.jsx';
import { ButtonClick }     from './ui/ButtonClick.jsx';
import { TypingInput }     from './ui/TypingInput.jsx';
import { BrowserWindow }   from './ui/BrowserWindow.jsx';
import { PhoneMockup }     from './ui/PhoneMockup.jsx';

// --- product
import { FeatureCard }     from './product/FeatureCard.jsx';
import { PricingCard }     from './product/PricingCard.jsx';
import { TestimonialCard } from './product/TestimonialCard.jsx';
import { StatsCounter }    from './product/StatsCounter.jsx';
import { LogoWall }        from './product/LogoWall.jsx';

// --- motion
import { GradientBlob }    from './motion/GradientBlob.jsx';
import { LightSweep }      from './motion/LightSweep.jsx';
import { ParticleField }   from './motion/ParticleField.jsx';
import { GlowRing }        from './motion/GlowRing.jsx';
import { ConfettiBurst }   from './motion/ConfettiBurst.jsx';

// --- media
import { ImageScene }      from './media/ImageScene.jsx';
import { ZoomPanImage }    from './media/ZoomPanImage.jsx';
import { LogoIntro }       from './media/LogoIntro.jsx';

// --- travel
import { MapRoute }        from './travel/MapRoute.jsx';
import { LocationPin }     from './travel/LocationPin.jsx';
import { BoardingPass }    from './travel/BoardingPass.jsx';

// --- ecommerce
import { ProductCard }     from './ecommerce/ProductCard.jsx';
import { PriceTag }        from './ecommerce/PriceTag.jsx';
import { ReviewStars }     from './ecommerce/ReviewStars.jsx';

// --- social
import { InstagramPostMockup } from './social/InstagramPostMockup.jsx';
import { LikeCounter }         from './social/LikeCounter.jsx';
import { CommentBubble }       from './social/CommentBubble.jsx';

// --- tech
import { ChatBubble }       from './tech/ChatBubble.jsx';
import { AIThinkingDots }   from './tech/AIThinkingDots.jsx';
import { VoiceWaveform }    from './tech/VoiceWaveform.jsx';
import { CodeBlockReveal }  from './tech/CodeBlockReveal.jsx';

// --- transitions
import { FadeTransition }   from './transitions/FadeTransition.jsx';
import { SlideTransition }  from './transitions/SlideTransition.jsx';
import { WipeTransition }   from './transitions/WipeTransition.jsx';
import { GlitchTransition } from './transitions/GlitchTransition.jsx';

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
