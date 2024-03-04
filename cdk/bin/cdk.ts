#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QBusinessCodeAnalysisStack } from '../lib/q-business-code-analysis-stack';

const app = new cdk.App();

new QBusinessCodeAnalysisStack(app, 'QBusinessCodeAnalysisCdkStack', {
});