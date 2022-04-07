![Scoutradioz logo](https://scoutradioz.s3.amazonaws.com/prod/images/brand-logos/scoutradioz-black-border-md.png)
## [scoutradioz.com](https://scoutradioz.com)
Scoutradioz is a multi-year FRC scouting app developed by The Gearheads which runs on Amazon Web Services (AWS).

Initially created in [2018](https://github.com/firstteam102/scoringapp-2018/), Scoutradioz has continually evolved as a platform. Here is a list of some of the features Scoutradioz offers:
- Modular and configurable pit & match scouting surveys, so your organization can pick exactly what info you want to record and show
- Automatic, individualized pit & match scouting assignments
- Advanced reports and metrics
- Event management tools such as auditing match assignments, swapping scouters in and out, and managing a list of members
- And of course, it's completely free!

**[Please visit the wiki](https://github.com/FIRSTTeam102/ScoringApp-Serverless/wiki) for documentation on how to use the app.**

## App structure
We use 
[AWS **L**ambda](https://aws.amazon.com/lambda), [**E**xpress](https://npmjs.com/package/express),
[**Mo**ngoDB](https://www.mongodb.com/), and [**N**ode](https://nodejs.com) (LEMoN); as well as [Pug](https://npmjs.com/package/pug), 
[Atlas](https://www.mongodb.com/atlas/database), [S3](https://aws.amazon.com/s3), 
[The Blue Alliance API](https://www.thebluealliance.com/apidocs), and many other libraries and packages.

### Primary
This is the primary Lambda function that serves most user requests. The https://scoutradioz.com website runs on the Primary function.

### Upload
This Lambda function handles two things:
- Photo uploads to AWS S3
- Dynamic generation of [header images](https://upload.scoutradioz.com/prod/generate/upcomingmatch?match_number=6&comp_level=qm&blue1=5842&blue2=117&blue3=4780&red1=4547&red2=102&red3=2051&assigned=red2) for push notifications, notifying scouters of an upcoming match assignment

_(The latter was introduced after upload.scoutradioz.com was created, but both routes require [image processing](https://www.npmjs.com/package/jimp) so we combined the two.)_

### Webhook
Scoutradioz is subscribed to [The Blue Alliance's Firehose](https://www.thebluealliance.com/apidocs/webhooks#firehose), which provides the site with up-to-date information on every supported match and event. This Lambda function handles data provided by the Firehose, and sends push notifications to scouters who are assigned to an upcoming match & have notifications enabled.

### Helper packages
#### [scoutradioz-utilities](https://www.npmjs.com/package/@firstteam102/scoutradioz-utilities)
An NPM package that contains our database manager / caching wrapper.

#### [scoutradioz-helpers](https://www.npmjs.com/package/@firstteam102/scoutradioz-helpers)
An NPM package that contains helper functions needed across multiple packages, such as parsing match data, calculating metrics, and listing team images.

#### [scoutradioz-http-errors](https://www.npmjs.com/package/@firstteam102/scoutradioz-http-errors)
A small NPM package that exposes a small handful of HTTP errors for use inside Express routes. We created this one instead of alternatives because it has no dependencies and only contains what we need.

#### scoutradioz-eslint
ESLint plugin, to assist development, which enforces a title being provided any time a page is rendered.
