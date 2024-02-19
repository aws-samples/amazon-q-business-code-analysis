#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QBusinessCodeAnalysisStack } from '../lib/q-business-code-analysis-stack';

const app = new cdk.App();

// Generate random number to avoid roles and lambda duplicates
const randomPrefix = Math.floor(Math.random() * (10000 - 100) + 100);

new QBusinessCodeAnalysisStack(app, 'QBusinessCodeAnalysisCdkStack', {
  randomPrefix: randomPrefix,
});