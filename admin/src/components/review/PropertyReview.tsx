import React from 'react';
import { PublishControls } from './PublishControls.tsx';
import { QualityChecklist, type ReviewCheck } from './QualityChecklist.tsx';
import { ResponsivePreview, type PreviewProperty } from './ResponsivePreview.tsx';

export const PropertyReview = ({ checks, score, recommendations, preview, publishable, onPublish }: { checks: ReviewCheck[]; score: number; recommendations?: string[]; preview: PreviewProperty; publishable: boolean; onPublish?: () => Promise<void> }) => <div className="property-review"><QualityChecklist checks={checks} score={score} recommendations={recommendations} /><ResponsivePreview property={preview} /><PublishControls publishable={publishable} onPublish={onPublish} /></div>;

