/* eslint-disable no-undef */
db.roads.insertMany([
{ road_id: 1, name: "A35", type: "Highway", length: 12.50 },
{ road_id: 2, name: "Bournemouth Rd", type: "Main", length: 5.30 },
{ road_id: 3, name: "Castle Lane", type: "Residential", length: 3.20 },
{ road_id: 4, name: "Ringwood Rd", type: "Main", length: 6.80 },
{ road_id: 5, name: "Holdenhurst Rd", type: "Highway", length: 10.10 }
]);
db.contractors.insertMany([
{ contractor_id: 1, company: "Dorset Infrastructure Ltd", phone: "01202-111111" },
{ contractor_id: 2, company: "South Coast Civil Works", phone: "01202-222222" },
{ contractor_id: 3, company: "Urban Roads Maintenance", phone: "01202-333333" },
{ contractor_id: 4, company: "Highway Solutions UK", phone: "01202-444444" },
{ contractor_id: 5, company: "Bournemouth BuildCo", phone: "01202-555555" }
]);
db.roadworks.insertMany([
{
  roadwork_id: 101,
  type: "Maintenance",
  impact: "Partial Closure",
  road_id: 1,
  contractors: [1,3]
},
{
  roadwork_id: 102,
  type: "Repair",
  impact: "Full Closure",
  road_id: 2,
  contractors: [2]
},
{
  roadwork_id: 103,
  type: "Construction",
  impact: "Partial Closure",
  road_id: 3,
  contractors: [5]
},
{
  roadwork_id: 104,
  type: "Construction",
  impact: "Partial Closure",
  road_id: 1,
  contractors: [1,4]
},
{
  roadwork_id: 105,
  type: "Maintenance",
  impact: "Partial Closure",
  road_id: 4,
  contractors: [3]
}
]);


