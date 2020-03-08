print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// create new collection, insert values
db.i18n.insert({language: "en_US", labels: {
    chooseOrgTeaser: "Scoutradioz enables multiple teams/organizations to gather their own customized intel at competitions. Select an organization below to see what data they have collected!",
    chooseOrgLinkText: "For more information on Scoutradioz (including how to join the platform), click here."
}});
