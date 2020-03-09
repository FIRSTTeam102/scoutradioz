![Scoutradioz logo](https://scoutradioz.s3.amazonaws.com/app/images/brand-logos/scoutradioz-black-lg.png)
## [scoutradioz.com](https://scoutradioz.com)
Multi-year FRC Scouting app developed by The Gearheads, designed for AWS Serverless.

**[Please visit the wiki](https://github.com/FIRSTTeam102/ScoringApp-Serverless/wiki) for documentation on how to use the app.**

## App structure
We use 
[AWS **L**ambda](https://aws.amazon.com/lambda), [**E**xpress](https://npmjs.com/package/express),
[**Mo**ngoDB](https://www.mongodb.com/), and [**N**ode](https://nodejs.com) (LEMoN); as well as [Pug](https://npmjs.com/package/pug), 
[Atlas](https://www.mongodb.com/cloud/atlas), [S3](https://aws.amazon.com/s3), 
[The Blue Alliance API](https://www.thebluealliance.com/apidocs), and many other libraries and packages.

### Primary
This is the primary Lambda function that serves most requests.

### Upload
This is a package that handles photo uploads to AWS S3.

### Scoutradioz-Utilities
This is an NPM package that contains our database manager / caching wrapper.
