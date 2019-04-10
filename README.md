## How to set up for development
1. Clone repository `https://github.com/FIRSTTeam102/ScoringApp-Serverless.git`.
2. Make sure you have Amazon's AWS CLI installed (https://aws.amazon.com/cli/)
3. Run `aws configure`.
  a. Enter access key ID
  b. Enter secret access key
4. This project has already been configured. To deploy, run `npm run package-deploy`. On Windows, run `npm run win-package-deploy`.

## About
This is a merge from our ScoringApp-2018 with AWS Labs' Express basic-starter example. (https://github.com/awslabs/aws-serverless-express/tree/master/examples/basic-starter)

Currently the project is bare-bones. We need to slowly add functionality as we rework our routes, to make sure they work with Lambda.
