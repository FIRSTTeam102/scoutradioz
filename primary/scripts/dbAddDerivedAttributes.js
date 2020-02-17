print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// add derived attributes to frc102, 2019
db.layout.insert({order: "0510", label: "Total game pieces", id: "totalPieces", operator: "sum", operands: [ "sandstormCargoShipCargo", "sandstormRocketCargo", "teleopCargoShipCargo", "teleopRocketCargo", "sandstormCargoShipPanel", "sandstormRocketPanel", "teleopCargoShipPanel", "teleopRocketPanel" ], org_key: "frc102", form_type: "matchscouting", year: 2019, type: "derived"})
db.layout.insert({order: "0520", label: "Total cargo", id: "totalCargo", operator: "sum", operands: [ "sandstormCargoShipCargo", "sandstormRocketCargo", "teleopCargoShipCargo", "teleopRocketCargo" ], org_key: "frc102", form_type: "matchscouting", year: 2019, type: "derived"})
db.layout.insert({order: "0530", label: "Total hatches", id: "totalPanel", operator: "sum", operands: [ "sandstormCargoShipPanel", "sandstormRocketPanel", "teleopCargoShipPanel", "teleopRocketPanel" ], org_key: "frc102", form_type: "matchscouting", year: 2019, type: "derived"})
db.layout.insert({order: "0540", label: "Total sandstorm", id: "totalSandstorm", operator: "sum", operands: [ "sandstormCargoShipCargo", "sandstormRocketCargo", "sandstormCargoShipPanel", "sandstormRocketPanel" ], org_key: "frc102", form_type: "matchscouting", year: 2019, type: "derived"})
db.layout.insert({order: "0550", label: "Total teleop", id: "totalTeleop", operator: "sum", operands: [ "teleopCargoShipCargo", "teleopRocketCargo", "teleopCargoShipPanel", "teleopRocketPanel" ], org_key: "frc102", form_type: "matchscouting", year: 2019, type: "derived"})
