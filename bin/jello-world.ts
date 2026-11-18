#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { buildApp } from "../lib/app";

// The stage comes from -c stage=dev|preview|prod (see lib/stage.ts).
const app = new App();
buildApp(app);
