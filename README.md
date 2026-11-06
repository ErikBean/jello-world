# jello-world

An agentic hello world.

This repo is for experimenting with shipping code via agents. The goal is a website that says **jello world!**, hosted on Amazon S3 behind Amazon CloudFront.

The site will be built and deployed with:

- [AWS CDK](https://aws.amazon.com/cdk/) for the infrastructure
- The AWS agent toolkit for working with AWS from an agent
- [Claude Code](https://claude.com/claude-code) as the agent writing and shipping the code
