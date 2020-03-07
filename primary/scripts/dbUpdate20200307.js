print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// create new collection, insert values
db.rankingpoints.insert({year: 2017, attributes: [ {label: "kPa Achieved", name: "kPaRankingPointAchieved", abbr: "KP"}, {label: "Rotor Achieved", name: "rotorRankingPointAchieved", abbr: "RO"} ]});
db.rankingpoints.insert({year: 2018, attributes: [ {label: "Auto Quest", name: "autoQuestRankingPoint", abbr: "AQ"}, {label: "Face The Boss", name: "faceTheBossRankingPoint", abbr: "FTB"} ]});
db.rankingpoints.insert({year: 2019, attributes: [ {label: "Complete Rocket", name: "completeRocketRankingPoint", abbr: "CR"}, {label: "Hab Docking", name: "habDockingRankingPoint", abbr: "HD"} ]});
db.rankingpoints.insert({year: 2020, attributes: [ {label: "Shield Operational", name: "shieldOperationalRankingPoint", abbr: "SO"}, {label: "Shield Energized", name: "shieldEnergizedRankingPoint", abbr: "SE"} ]});
