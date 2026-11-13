// LearnPage.tsx — The course shell: header, badge shelf, level tabs and views.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LEVELS, WORKSHOPS, levelById, levelForLesson, lessonById } from '../learn/curriculum';
import type { Level, Lesson } from '../learn/types';
import { useLearn } from '../learn/useLearn';
import { BadgeShelf } from './learn/BadgeShelf';
import { LevelSwitcher } from './learn/LevelSwitcher';
import { Overview, CertificateView } from './learn/Overview';
import { LessonView } from './learn/LessonView';
import { LevelQuiz } from './learn/Quiz';
import { BadgesView } from './learn/BadgesView';
import { GlossaryView } from './learn/GlossaryView';
import { RewardDialog } from './learn/RewardDialog';
import { useViewScroll, type LearnScrollMode } from './learn/useViewScroll';
import type { EarnedBadge } from '../learn/useLearn';
import './LearnPage.css';

type LearnRoute =
  | { kind: 'level'; levelId: string }
  | { kind: 'lesson'; levelId: string; lessonId: string }
  | { kind: 'quiz'; levelId: string }
  | { kind: 'certificate'; levelId: string }
  | { kind: 'badges' }
  | { kind: 'glossary' }
  | { kind: 'workshops' };

const LEARN_ROOT = '#/learn';

function parseRoute(hash: string, fallbackLevel: string): LearnRoute {
  const raw = hash.replace(/^#\/learn\/?/, '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { kind: 'level', levelId: fallbackLevel };
  if (parts[0] === 'badges') return { kind: 'badges' };
  if (parts[0] === 'glossary') return { kind: 'glossary' };
  if (parts[0] === 'workshops') return { kind: 'workshops' };
  const level = levelById(parts[0]);
  if (!level) return { kind: 'level', levelId: fallbackLevel };
  if (parts[1] === 'quiz') return { kind: 'quiz', levelId: level.id };
  if (parts[1] === 'certificate') return { kind: 'certificate', levelId: level.id };
  if (parts[1]) return { kind: 'lesson', levelId: level.id, lessonId: parts[1] };
  return { kind: 'level', levelId: level.id };
}

function routeKey(route: LearnRoute): string {
  switch (route.kind) {
    case 'lesson':
      return `lesson:${route.levelId}:${route.lessonId}`;
    case 'level':
      return `level:${route.levelId}`;
    case 'quiz':
      return `quiz:${route.levelId}`;
    case 'certificate':
      return `certificate:${route.levelId}`;
    default:
      return route.kind;
  }
}

function scrollMode(route: LearnRoute): LearnScrollMode {
  if (route.kind === 'level') return 'overview';
  if (route.kind === 'badges' || route.kind === 'glossary' || route.kind === 'workshops') return 'top';
  return 'switcher';
}

export default function LearnPage() {
  const learn = useLearn();
  const [hash, setHash] = useState(() => window.location.hash);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [shelfFocus, setShelfFocus] = useState<{ levelId: string; nonce: number } | null>(null);
  const [reward, setReward] = useState<{ badge: EarnedBadge; level: Level } | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => () => {
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
  }, []);

  const route = parseRoute(hash, learn.progress.lastLevel || 'beginner');
  const currentLevel =
    levelById(route.kind === 'level' || route.kind === 'lesson' || route.kind === 'quiz' || route.kind === 'certificate' ? route.levelId : learn.progress.lastLevel) ??
    LEVELS[0];
  const activeId = route.kind === 'workshops' ? 'workshops' : currentLevel.id;
  const viewKey = routeKey(route);

  const shelfRequested = route.kind === 'level' && shelfFocus?.levelId === route.levelId;
  useViewScroll(
    viewKey,
    shelfRequested ? 'shelf' : scrollMode(route),
    switcherRef,
    viewRef,
    !learn.loading,
    shelfRef,
    shelfFocus?.nonce ?? 0,
  );

  const setLastLevel = learn.setLastLevel;

  useEffect(() => {
    if (learn.loading) return;
    if (route.kind === 'badges' || route.kind === 'glossary' || route.kind === 'workshops') return;
    setLastLevel(currentLevel.id);
  }, [currentLevel.id, learn.loading, route.kind, setLastLevel]);

  const navigate = useCallback((path: string) => {
    const target = path ? `${LEARN_ROOT}/${path}` : LEARN_ROOT;
    if (window.location.hash === target) {
      setHash(target);
      return;
    }
    window.location.hash = target;
  }, []);

  const openLevel = useCallback(
    (levelId: string) => {
      setShelfFocus(null);
      navigate(levelId);
    },
    [navigate],
  );

  const openLesson = useCallback(
    (lesson: Lesson) => {
      if (lesson.status !== 'live') return;
      const level = levelForLesson(lesson.id);
      if (!level) return;
      if (!learn.isLessonDone(lesson.id) && !learn.isLessonUnlocked(level, lesson.id)) {
        navigate(level.id);
        return;
      }
      navigate(`${level.id}/${lesson.id}`);
    },
    [learn, navigate],
  );

  const openCertificate = useCallback(
    (level: Level) => {
      if (learn.isCertified(level.id)) navigate(`${level.id}/certificate`);
      else openLevel(level.id);
    },
    [learn, navigate, openLevel],
  );

  const handleFinish = useCallback(() => {
    const level = currentLevel;
    const lessonId = route.kind === 'lesson' ? route.lessonId : null;
    if (!lessonId) return;
    const lesson = lessonById(lessonId);
    if (!lesson) return;
    const badge = learn.completeLesson(lesson);
    if (badge) setReward({ badge, level });
  }, [currentLevel, learn, route]);

  const rewardNext = useCallback(() => {
    if (!reward) return;
    const { badge, level } = reward;
    const next = learn.laterLesson(level, badge.lessonId);
    setPulseId(badge.lessonId);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulseId(null), 3200);
    setReward(null);
    if (next) navigate(`${level.id}/${next.id}`);
    else navigate(level.id);
  }, [learn, navigate, reward]);

  const handleQuizPass = useCallback(
    (firstTry: number) => {
      learn.certifyLevel(currentLevel, firstTry);
      navigate(`${currentLevel.id}/certificate`);
    },
    [currentLevel, learn, navigate],
  );

  const continueLabel = learn.nextUnfinished ? 'Continue' : undefined;

  const handleContinue = useCallback(() => {
    if (learn.nextUnfinished) {
      navigate(`${learn.nextUnfinished.level.id}/${learn.nextUnfinished.lesson.id}`);
      return;
    }
    navigate('beginner/certificate');
  }, [learn.nextUnfinished, navigate]);

  const counts = useCallback((level: Level) => learn.levelCounts(level), [learn]);

  if (learn.loading) {
    return (
      <div className="learn-page">
        <div className="learn-loading">
          <p>Loading your progress.</p>
        </div>
      </div>
    );
  }

  const lesson =
    route.kind === 'lesson' ? lessonById(route.lessonId) : undefined;
  const lessonLevel = lesson ? levelForLesson(lesson.id) : undefined;
  const lessonUnlocked =
    lesson && lessonLevel ? learn.isLessonDone(lesson.id) || learn.isLessonUnlocked(lessonLevel, lesson.id) : false;
  const showLesson = Boolean(lesson && lesson.content && lessonLevel && lessonUnlocked);
  const showQuiz =
    route.kind === 'quiz' && currentLevel.status === 'live' && learn.allLessonsDone(currentLevel);
  const showCertificate = route.kind === 'certificate' && learn.isCertified(currentLevel.id);

  let view: ReactNode;
  if (route.kind === 'badges') {
    view = <BadgesView progress={learn.progress} onOpenLesson={openLesson} onOpenLevel={openLevel} />;
  } else if (route.kind === 'glossary') {
    view = <GlossaryView onOpenLesson={openLesson} />;
  } else if (route.kind === 'workshops') {
    view = <WorkshopsView />;
  } else if (showLesson && lesson && lessonLevel) {
    const previous = learn.earlierLesson(lessonLevel, lesson.id);
    const next = learn.laterLesson(lessonLevel, lesson.id);
    view = (
      <LessonView
        level={lessonLevel}
        lesson={lesson}
        progress={learn.progress}
        isDone={learn.isLessonDone}
        allDone={learn.allLessonsDone(lessonLevel)}
        previous={previous}
        next={next}
        onOpenLesson={openLesson}
        onOpenQuiz={() => navigate(`${lessonLevel.id}/quiz`)}
        onBack={() => navigate(lessonLevel.id)}
        onPrevious={() => previous && navigate(`${lessonLevel.id}/${previous.id}`)}
        onNext={() => {
          if (!learn.isLessonDone(lesson.id)) return;
          if (next) navigate(`${lessonLevel.id}/${next.id}`);
          else navigate(lessonLevel.id);
        }}
        onFinish={handleFinish}
      />
    );
  } else if (showQuiz) {
    view = (
      <LevelQuiz
        level={currentLevel}
        onPass={handleQuizPass}
        onBack={() => navigate(currentLevel.id)}
      />
    );
  } else if (showCertificate) {
    view = (
      <CertificateView
        level={currentLevel}
        progress={learn.progress}
        onSwitchLevel={openLevel}
        onBack={() => navigate(currentLevel.id)}
      />
    );
  } else {
    view = (
      <Overview
        level={currentLevel}
        progress={learn.progress}
        isDone={learn.isLessonDone}
        isUnlocked={learn.isLessonUnlocked}
        allDone={learn.allLessonsDone(currentLevel)}
        certified={learn.isCertified(currentLevel.id)}
        onOpenLesson={openLesson}
        onOpenQuiz={() => navigate(`${currentLevel.id}/quiz`)}
        onSwitchLevel={openLevel}
      />
    );
  }

  return (
    <div className="learn-page">
      <header className="learn-header">
        <div>
          <h1>Learn</h1>
          <p>Short lessons that start from what a share is.</p>
        </div>
        <button type="button" className="learn-text-link" onClick={() => navigate('glossary')}>
          Glossary
        </button>
      </header>

      <BadgeShelf
        progress={learn.progress}
        pulseId={pulseId}
        currentLessonId={learn.nextUnfinished?.lesson.id ?? null}
        focusRequest={shelfFocus}
        shelfRef={shelfRef}
        onOpenAll={() => navigate('badges')}
        onOpenLesson={openLesson}
        onOpenLevel={openCertificate}
      />

      <LevelSwitcher
        activeId={activeId}
        progress={learn.progress}
        counts={counts}
        onSelect={(id) => {
          if (id === 'workshops') {
            navigate('workshops');
            return;
          }
          openLevel(id);
          // Runs after openLevel clears it, so this press scrolls to the shelf.
          setShelfFocus((current) => ({ levelId: id, nonce: (current?.nonce ?? 0) + 1 }));
        }}
        onContinue={continueLabel ? handleContinue : undefined}
        continueLabel={continueLabel}
        innerRef={switcherRef}
      />

      <div className="learn-view-anchor" ref={viewRef}>
        <div className="learn-view-transition" key={viewKey}>
          {view}
        </div>
      </div>

      {reward && (
        <RewardDialog
          badge={reward.badge}
          levelIndex={reward.level.number - 1}
          lastLesson={!learn.laterLesson(reward.level, reward.badge.lessonId)}
          onNext={rewardNext}
          onSeeAll={() => {
            setReward(null);
            navigate('badges');
          }}
          onClose={() => setReward(null)}
        />
      )}
    </div>
  );
}

function WorkshopsView() {
  return (
    <div className="learn-view learn-view--wide">
      <p className="learn-kicker">Open tracks</p>
      <h1 className="learn-level-title">Workshops</h1>
      <p className="learn-lead">
        Longer tracks for work that does not fit in a lesson. These are planned and not open yet.
      </p>
      <div className="learn-workshops">
        {WORKSHOPS.map((workshop) => (
          <article className="learn-workshop" key={workshop.id}>
            <p className="learn-workshop-status">Planned</p>
            <h2>{workshop.title}</h2>
            <p>{workshop.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
