//Constants
var WIDTH = 960; //SVG width
var HEIGHT = 500; //SVG height
var RADIUS = 1; //site's radius
var EPSILON = 0.000001; //Error margin


var body = d3.select("body");

var svg = d3.select("#chart")
        .append("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT);


//Global variables
var sites = [];
var voronoi = null;
var diagram = null;

var sitesg = svg.append("g")
                .attr("class", "site");

var visible_polygonsg = svg.append("g")
                           .attr("class", "visible_polygon");

var polygonsg = svg.append("g")
                   .attr("class", "polygon");

var linesg = svg.append("g")
                .attr("class", "voronoi_edge");

var portalsg = svg.append("g")
                  .attr("class", "portal");

var map_is_border_edge = [];

var site_current_avaible_key = 0;
var current_avaible_edge_key = 0;
var current_portal_candidate = null;

var observer_position = null;
var observer_cell = null;

var maximum_portal_size = 30.0; //Default value


//Visibility graph
adj = [];

//Flags
var flag_creating_sites = true;
var flag_observer = false; //if observer has already been created

//Events
body.on("keydown", keydown);
svg.on("click", mouse_click);


/*====================================================*/
/* Listeners */
/*====================================================*/

function mouse_click() {
  var current_mouse_position = d3.mouse(this);
  if (flag_creating_sites) {
    create_site(current_mouse_position);
  }
}


function mouse_move_or_enter_line(d){
  var current_mouse_position = d3.mouse(this);

  if (current_portal_candidate != null){
    delete_current_portal_candidate();
  }
  var line = d3.select(this);
  var line_coordinates = [[d['edge'][0][0], d['edge'][0][1]], [d['edge'][1][0], d['edge'][1][1]]];
  var position = get_point_on_line(current_mouse_position, line_coordinates);
  create_portal_candidate(position, line_coordinates, line);
  //var neighbours = diagram.find(current_mouse_position[0], current_mouse_position[1]);
}

function mouse_click_portal_candidate(d){
  create_portal();
  delete_current_portal_candidate();
}

function mouse_dblclick_polygon(d, i){
  var current_mouse_position = d3.mouse(this);
  if (!flag_creating_sites) {
    define_observer(current_mouse_position, i);
  }
}

function mouse_enter_portal(d){
  var portal = d3.select(this);
  portal.classed("selected_portal", true);
}

function mouse_leave_portal(d){
  var portal = d3.select(this);
  portal.classed("selected_portal", false);
}

function mouse_dblclick_portal(d){
  var portal = d3.select(this);
  delete_portal(portal);
}

function keydown(){
  keyCode = d3.event.keyCode;
  switch (keyCode) {
    case 27: //Esc key
      if(current_portal_candidate != null){
        delete_current_portal_candidate();
      }
    case 32: //Space key
      if(flag_creating_sites) {
        create_voronoi_rooms();
        flag_creating_sites = false
      }
      break;
    case 187: //Plus key
      if (d3.event.shiftKey) maximum_portal_size += 2;
      break;
    case 189: //Minus key
      maximum_portal_size = Math.max(maximum_portal_size - 2, 1);
      break;
  }
}


/*====================================================*/
/*General functions*/
/*====================================================*/



/*Voronoi diagram*/

function create_site(position) {
  sites.push(position);

  sitesg.append("circle")
        .attr("cx", position[0])
        .attr("cy", position[1])
        .attr("r", RADIUS)
        .attr("index", site_current_avaible_key);

  site_current_avaible_key += 1;
  add_vertex();
}

function create_voronoi_rooms() {
  create_voronoi_diagram();
}


function create_voronoi_diagram(){
  voronoi = d3.voronoi()
              .extent([[0, 0], [WIDTH, HEIGHT]]);
  diagram = voronoi(sites);
  create_voronoi_polygons();
  create_voronoi_lines();
}

function create_voronoi_polygons(){
  var polygon = polygonsg.selectAll("path")
                         .data(diagram.polygons())
                         .enter()
                         .append("path")
                         .call(draw_polygon)
                         .on("dblclick", mouse_dblclick_polygon);
}

function draw_polygon(polygon) {
  polygon.attr("d", function(d) {return d ?  "M " + d.join("L ") + " Z" : null; })
         .attr("index", function(d, i) { return i;});
}

function create_voronoi_lines() {
 var edges = [];
 var is_border_edge;

 for(var i = 0, len = diagram.edges.length; i < len; i++){
   var edge = diagram.edges[i];

   if (edge == null){
     continue;
   }

   if (!((edge[0][1] == 0 && edge[1][1] == 0) ||
         (edge[0][1] == HEIGHT && edge[1][1] == HEIGHT) ||
         (edge[0][0] == 0 && edge[1][0] == 0) ||
         (edge[0][0] == WIDTH && edge[1][0] == WIDTH))){

     is_border_edge = false;
     edges.push({"edge": edge, "index": i});
   }
   else{
     is_border_edge = true;
   }

   map_is_border_edge.push(is_border_edge);
 }

  var line = linesg.selectAll("line")
                   .data(edges)
                   .enter()
                   .append("line")
                   .call(draw_line);
}

function draw_line(line){
  line.attr("x1", function(d){ return d['edge'] ? d['edge'][0][0] : null;})
      .attr("y1", function(d){ return d['edge'] ? d['edge'][0][1] : null;})
      .attr("x2", function(d){ return d['edge'] ? d['edge'][1][0] : null;})
      .attr("y2", function(d){ return d['edge'] ? d['edge'][1][1] : null;})
      .attr("left", function(d){ return d['edge'] ? d['edge'].left.index : null;})
      .attr("right", function(d){ return d['edge'] ? (d['edge'].right ? d['edge'].right.index : null) : null;})
      .attr("index", function(d) { return d['index'];})
      .on("mouseenter", mouse_move_or_enter_line);
}

/*Observer*/
function define_observer(position, site_index){
  if (!flag_observer){
    svg.append("circle")
       .attr("cx", position[0])
       .attr("cy", position[1])
       .attr("r", 6)
       .attr("class", "observer")
       .attr("site_index", site_index);

    flag_observer = true;
  }
  else {
    redraw_observer(position, site_index);
  }
  observer_position = position;
  observer_cell = site_index;

  determine_visibility();
}

function redraw_observer(position, site_index){
  d3.select(".observer")
    .attr("cx", position[0])
    .attr("cy", position[1])
    .attr("site_index", site_index);
}


/*Portals*/
function create_portal_candidate(position, line_coordinates, line){
  var c  = get_portal_candidate_coordinates(position, line_coordinates);
  var x1 = c[0], y1 = c[1], x2 = c[2], y2 = c[3];
  var left = line.attr("left"), right = line.attr("right");
  var voronoi_edge_index = line.attr("index");

  current_portal_candidate = svg.append("line")
                                .attr("x1", x1)
                                .attr("y1", y1)
                                .attr("x2", x2)
                                .attr("y2", y2)
                                .attr("left", left)
                                .attr("right", right)
                                .attr("voronoi_edge_index", voronoi_edge_index)
                                .attr("class", "portal_candidate");

  current_portal_candidate.on("click",  mouse_click_portal_candidate);
}

function get_point_on_line(current_mouse_position, line_coordinates){
  var x_min = Math.min(line_coordinates[0][0], line_coordinates[1][0]);
  var x_max = Math.max(line_coordinates[0][0], line_coordinates[1][0]);
  var y_min = Math.min(line_coordinates[0][1], line_coordinates[1][1]);
  var y_max = Math.max(line_coordinates[0][1], line_coordinates[1][1]);
  var x, y; var a, b;

  var vertical = is_vertical_or_quasi_vertical(line_coordinates);

  if(vertical){
    x = line_coordinates[0][0]; y = current_mouse_position[1];

    if(y < y_min){
      y = y_min;
    }
    else if(y > y_max){
      y = y_max;
    }

    if(line_coordinates[0][0] != line_coordinates[1][0]){
      a = get_slope(line_coordinates[0], line_coordinates[1]);
      b = line_coordinates[0][1] - a*line_coordinates[0][0];
      x = (y - b)/a;
    }

    return [x, y];
  }


  var a = get_slope(line_coordinates[0], line_coordinates[1]);
  var b = line_coordinates[0][1] - a*line_coordinates[0][0];
  x = current_mouse_position[0]; y = line_coordinates[0][1];

  if(x < x_min){
    x = x_min;
  }
  else if(x > x_max){
    x = x_max;
  }
  p1 = [x, a*x + b];

  if(a <= EPSILON){
    return p1;
  }


  y = current_mouse_position[1];
  if(y < y_min){
    y = y_min;
  }
  else if(y > y_max){
    y = y_max;
  }
  p2 = [(y - b)/a, y];

  var d1 = euclidean_distance(current_mouse_position, p1), d2 = euclidean_distance(current_mouse_position, p2);

  return d1 <= d2 ? p1 : p2;
}

function is_vertical_or_quasi_vertical(segment){
  var slope_threshold = 10;
  return (segment[0][0] == segment[1][0]) || (Math.abs(get_slope(segment[0], segment[1])) >= slope_threshold);
}

function get_portal_candidate_coordinates(position, line_coordinates){
  var x1 = null, y1 = null, x2 = null, y2 = null;
  var vector_1 = [line_coordinates[0][0] - position[0], line_coordinates[0][1] - position[1]];
  var vector_2 = [line_coordinates[1][0] - position[0], line_coordinates[1][1] - position[1]];

  var mod_vector_1 = norm(vector_1);
  var mod_vector_2 = norm(vector_2);

  var d1 = maximum_portal_size / 2.0, d2 = maximum_portal_size / 2.0;

  if(mod_vector_1 < maximum_portal_size / 2.0){
    d1 = mod_vector_1;
  }
  if(mod_vector_2 < maximum_portal_size / 2.0){
    d2 = mod_vector_2;
  }

  var unitary_vector_1 = [vector_1[0] / mod_vector_1, vector_1[1] / mod_vector_1];
  var unitary_vector_2 = [vector_2[0] / mod_vector_2, vector_2[1] / mod_vector_2];

  x1 = (unitary_vector_1[0]*d1) + position[0];  y1 = (unitary_vector_1[1]*d1) + position[1];
  x2 = (unitary_vector_2[0]*d2) + position[0];  y2 = (unitary_vector_2[1]*d2) + position[1];

  return [x1, y1, x2, y2];
}


function norm(u){
  return euclidean_distance(u, [0, 0]);
}

function euclidean_distance(u, v){
  return Math.sqrt((v[0] - u[0])*(v[0] - u[0]) + (v[1] - u[1])*(v[1] - u[1]));
}


function create_portal(){
  var x1 = parseFloat(current_portal_candidate.attr("x1")), y1 = parseFloat(current_portal_candidate.attr("y1"));
  var x2 = parseFloat(current_portal_candidate.attr("x2")), y2 = parseFloat(current_portal_candidate.attr("y2"));
  var voronoi_edge_index = current_portal_candidate.attr("voronoi_edge_index");
  var flag_non_empty_intersection = seek_portal_overlapped(voronoi_edge_index, [[x1, y1], [x2, y2]]);

  if(!flag_non_empty_intersection){
  var left = current_portal_candidate.attr("left"), right = current_portal_candidate.attr("right");
  var key = current_avaible_edge_key; current_avaible_edge_key += 1;

  var portal = portalsg.append("line")
                       .attr("x1", x1)
                       .attr("y1", y1)
                       .attr("x2", x2)
                       .attr("y2", y2)
                       .attr("left", left)
                       .attr("right", right)
                       .attr("key", key)
                       .attr("voronoi_edge_index", voronoi_edge_index)
                       .on("mouseenter", mouse_enter_portal)
                       .on("mouseleave", mouse_leave_portal)
                       .on("dblclick", mouse_dblclick_portal);

    add_edge(left, right, portal);
  }

  //Update visibility
  if (flag_observer){
    determine_visibility();
  }
}

function seek_portal_overlapped(voronoi_edge_index, currrent_portal_candidate_segment){
  /*portals on the same voronoi edge*/
  var portals = portalsg.selectAll("[voronoi_edge_index='" + voronoi_edge_index + "']").nodes();
  var n = 0;
  var previous_updated_portal;

  for(var i = 0, len = portals.length; i < len && n < 2; i++){
    var x1 = portals[i].getAttribute('x1'), y1 = portals[i].getAttribute('y1');
    var x2 = portals[i].getAttribute('x2'), y2 = portals[i].getAttribute('y2');
    var portal_segment = [[x1, y1], [x2, y2]];

    var intersection_points = equal_slope_segments_intersection(currrent_portal_candidate_segment, portal_segment);
    //var intersection_points = segments_intersection(currrent_portal_candidate_segment, portal_segment);
    if(intersection_points.length > 0){ //intersection is non-empty
      var key = portals[i].getAttribute('key');
      var portal = portalsg.select("[key='" + key + "']");

      var union_segment = segments_union(currrent_portal_candidate_segment, portal_segment);
      update_portal_coordinates(portal, union_segment);
      currrent_portal_candidate_segment = union_segment;

      if(n > 0){
        delete_portal(previous_updated_portal);
        previous_updated_portal = null;
      }
      else{
        previous_updated_portal = portal;
      }

      n += 1;
    }
  }

  return n > 0;
}


function delete_current_portal_candidate(){
  current_portal_candidate.remove();
  current_portal_candidate = null;
}


function delete_portal(portal){
  remove_edge(portal);
  portal.remove();
  portal = null;

  if (flag_observer){
    determine_visibility();
  }
}

/*Visibility graph*/

function add_vertex(){
  adj.push([]);
}

function add_edge(u, v, portal){
  var key = portal.attr("key");
  adj[u].push({"neighbour": v, "key": key});
  adj[v].push({"neighbour": u, "key": key});
}

function remove_edge(portal){
  var u = parseInt(portal.attr("left")), v = parseInt(portal.attr("right"));
  var key = parseInt(portal.attr("key"));

  var start = 0, end = adj[u].length - 1, pos = Math.floor((start + end) / 2);
  while(start <= end){
    if(adj[u][pos]['key'] == key){
      adj[u].splice(pos, 1);
      break; //start = end + 1;
    }
    else if(adj[u][pos]['key'] < key){
      start = pos + 1;
    }
    else{
      end = pos - 1;
    }
    pos = Math.floor((start + end) / 2);
  }

  start = 0, end = adj[v].length - 1, pos = Math.floor((start + end) / 2);
  while(start <= end){
    if(adj[v][pos]['key'] == key){
      adj[v].splice(pos, 1);
      break;//start = end + 1;
    }
    else if(adj[v][pos]['key'] < key){
      start = pos + 1;
    }
    else{
      end = pos - 1;
    }
    pos = Math.floor((start + end) / 2);
  }
}


function verify_collinearity(p1, p2, p3){
  //var a1 = get_slope(p1, p3), a2 = get_slope(p3, p2);
  //return a1 == a2;
  return triangle_area(p1, p2, p3) <= EPSILON;
}

function within(p1, p2, p3){
  return (p3[0] <= Math.max(p1[0], p2[0])) && (p3[0] >= Math.min(p1[0], p2[0])) && (p3[1] <= Math.max(p1[1], p2[1])) && p3[1] >= Math.min(p1[1], p2[1]);
}

function triangle_area(p1, p2, p3){
  return 0.5*(p1[0]*(p2[1] - p3[1]) + p2[0]*(p3[1] - p1[1]) + p3[0]*(p1[1] - p2[1]));
}

function get_slope(p1, p2){
  var x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
  var deltax = (x2 - x1);
  var deltay = (y2 - y1);
  var a = deltax != 0 ?  deltay / deltax : NaN;
  return a;
}

function segments_intersection(segment_1, segment_2){
  var a1 = get_slope(segment_1[0], segment_1[1]), a2 = get_slope(segment_2[0], segment_2[1]);
  if(Math.abs(a1 - a2) <= EPSILON){ //they have the same slope
    return equal_slope_segments_intersection(segment_1, segment_2);
  }
  return distinct_slope_segments_intersection(segment_1, segment_2);
}

function equal_slope_segments_intersection(segment_1, segment_2){
  if(verify_collinearity(segment_1[0], segment_1[1], segment_2[0])){
    var w1 = within(segment_1[0], segment_1[1], segment_2[0]);
    var w2 = within(segment_1[0], segment_1[1], segment_2[1]);

    var w3 = within(segment_2[0], segment_2[1], segment_1[0]);
    var w4 = within(segment_2[0], segment_2[1], segment_1[1]);

    if(w1 && w2){ //segment 2 is contained in segment 1;
      return segment_2;
    }
    if(w3 && w4){ //segment 1 is contained in segment 2;
      return segment_1;
    }

    if(w1 && w3){
      return [segment_1[0], segment_2[0]];
    }
    if(w1 && w4){
      return [segment_1[1], segment_2[0]];
    }
    if(w2 && w3){
      return [segment_1[0], segment_2[1]];
    }
    if(w2 && w4){
      return [segment_1[1], segment_2[1]];
    }
  }
  return []; //empty intersection, they are parallel
}

function distinct_slope_segments_intersection(segment_1, segment_2){
  /* Parametric equation of the line segments
    segment_1 = lambda*segment_1[0] + (1-lambda)*segment_1[1]
    segment_2 = mi*segment_2[0] + (1-mi)*segment_2[1]
  */
  var v1 = [segment_1[0][0] - segment_1[1][0], segment_1[0][1] - segment_1[1][1]];
  var v2 = [segment_2[1][0] - segment_2[0][0], segment_2[1][1] - segment_2[0][1]];
  var v3 = [segment_2[1][0] - segment_1[1][0], segment_2[1][1] - segment_1[1][1]];

  var D = cross_product(v1, v2);
  var lambda = cross_product(v3, v2) / D;
  var mi = cross_product(v1, v3) / D;

  if((lambda >= 0) && (lambda <=1) && (mi >= 0) && (mi <=1)){
    var x = lambda*segment_1[0][0] + (1-lambda)*segment_1[1][0];
    var y = lambda*segment_1[1][0] + (1-lambda)*segment_1[1][1];
    return [x, y];
  }
  return []; //empty intersection
}

function cross_product(v1, v2){
  return v1[0] * v2[1] - v2[0]*v1[1];
}

/*we suppose that segment_1 and segment_2 are colinear*/
function segments_union(segment_1, segment_2){
  var max_segment_1, min_segment_1, max_segment_2, min_segment_2, absolute_max, absolute_min;
  //Case 1: vertical segments
  var vertical = is_vertical_or_quasi_vertical(segment_1); //equivalently is_vertical_or_quasi_vertical(segment_2)
  if(vertical){

    if(parseFloat(segment_1[0][1]) >= parseFloat(segment_1[1][1])){
      max_segment_1 = segment_1[0]; min_segment_1 = segment_1[1];
    }
    else{
      max_segment_1 = segment_1[1]; min_segment_1 = segment_1[0];
    }
    if(parseFloat(segment_2[0][1]) >= parseFloat(segment_2[1][1])){
      max_segment_2 = segment_2[0]; min_segment_2 = segment_2[1];
    }
    else{
      max_segment_2 = segment_2[1]; min_segment_2 = segment_2[0];
    }

    if(parseFloat(max_segment_1[1]) >= parseFloat(max_segment_2[1])){
      absolute_max = max_segment_1;
    }
    else{
      absolute_max = max_segment_2;
    }
    if(parseFloat(min_segment_1[1]) < parseFloat(min_segment_2[1])){
      absolute_min = min_segment_1;
    }
    else{
      absolute_min = min_segment_2;
    }

    return [absolute_min, absolute_max];
  }

  //Case 2: non vertical segments
  if(parseFloat(segment_1[0][0]) >= parseFloat(segment_1[1][0])){
    max_segment_1 = segment_1[0]; min_segment_1 = segment_1[1];
  }
  else{
    max_segment_1 = segment_1[1]; min_segment_1 = segment_1[0];
  }
  if(parseFloat(segment_2[0][0]) >= parseFloat(segment_2[1][0])){
    max_segment_2 = segment_2[0]; min_segment_2 = segment_2[1];
  }
  else{
    max_segment_2 = segment_2[1]; min_segment_2 = segment_2[0];
  }

  if(parseFloat(max_segment_1[0]) >= parseFloat(max_segment_2[0])){
    absolute_max = max_segment_1;
  }
  else{
    absolute_max = max_segment_2;
  }
  if(parseFloat(min_segment_1[0]) < parseFloat(min_segment_2[0])){
    absolute_min = min_segment_1;
  }
  else{
    absolute_min = min_segment_2;
  }

  return [absolute_min, absolute_max];
}


function update_portal_coordinates(portal, segment){
  portal.attr("x1", segment[0][0])
        .attr("y1", segment[0][1])
        .attr("x2", segment[1][0])
        .attr("y2", segment[1][1]);
}


function _lines_intersection(point_line_1, vector_line_1, point_line_2, vector_line_2){
  var a1 = get_slope([0, 0], vector_line_1);
  var a2 = get_slope([0, 0], vector_line_2);

  if(Math.abs(a1 - a2) <= EPSILON){
    //line_1 is undefined in this case
    if(vector_line_1[0] == 0 && vector_line_1[1] == 0)
      return {"point": [], "coefficient" : null, "equal": false};
    if(vector_line_1[0] == 0){
      return (point_line_2[0] == point_line_1[0])
                                 ? {"point": point_line_1, "coefficient" : null, "equal": true}
                                 : {"point": [], "coefficient" : null, "equal": false};
    }
    if(vector_line_1[1] == 0){
      return (point_line_2[1] == point_line_1[1])
                                  ? {"point": point_line_1, "coefficient" : null, "equal": true}
                                  : {"point": [], "coefficient" : null, "equal": false};

    }

    var lambda = (point_line_2[0] - point_line_1[0]) / vector_line_1[0];
    var lambda_ = (point_line_2[1] - point_line_1[1]) / vector_line_1[1];

    //line_1 and line_2 are the same line. In this case, we return just a point which belongs to this line.
    if(lambda == lambda_){
      return {"point": point_line_1, "coefficient" : lambda, "equal": true};
    }

    return {"point": [], "coefficient" : null, "equal": false}; //line_1 is parallel to line_2
  }

  var D = cross_product(vector_line_1, vector_line_2);
  var lambda = (vector_line_1[0]*(point_line_1[1] - point_line_2[1]) + vector_line_1[1]*(point_line_2[0] - point_line_1[0])) / D;

  var x = point_line_2[0] + vector_line_2[0]*lambda;
  var y = point_line_2[1] + vector_line_2[1]*lambda;

  //var mi = (vector_line_2[1]*(point_line_2[0] - point_line_1[0]) + vector_line_2[0]*(point_line_1[1] - point_line_2[1])) / D;
  // var x_ = point_line_1[0] + vector_line_1[0]*mi;
  // var y_ = point_line_1[1] + vector_line_1[1]*mi;

  return {"point": [x, y], "coefficient" : lambda, "equal": false};
}

function lines_intersection(point_line_1, vector_line_1, point_line_2, vector_line_2){
  return _lines_intersection(point_line_1, vector_line_1, point_line_2, vector_line_2)['point'];
}


function line_segment_intersection(point_line, line_vector, segment){
  var segment_arbitrary_point = segment[0];
  var segment_vector = [segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]];
  //var lines_intersection_points = lines_intersection(point_line, line_vector, segment_arbitrary_point, segment_vector);
  var aux_intersection = _lines_intersection(point_line, line_vector, segment_arbitrary_point, segment_vector);
  var lines_intersection_point = aux_intersection['point'];

  if(lines_intersection_point.length == 0){
    return {"point" : [], "equal": false};
  }
  else {
    var within_segment = within(segment[0], segment[1], lines_intersection_point);
    return within_segment ? {"point": lines_intersection_point, "equal": aux_intersection['equal']} : {"point": [], "equal": false};
  }
}

function equal_points(p1, p2){
  return (p1[0] == p2[0]) && (p1[1] == p2[1]);
}

function orient(p1, p2, p3){
  return p2[0]*p3[1] + p1[0]*p2[1] + p1[1]*p3[0] - p1[1]*p2[0] - p2[1]*p3[0] - p1[0]*p3[1];
}

function mod(n, m) {
  return ((n % m) + m) % m;
}



// Define visibility
function determine_visibility(){
  var visible_cells = new Set(); visible_cells.add(observer_cell);
  var visible_polygons = [];
  var visited_portals = {};
  find_visible_regions(observer_cell, visible_cells, visible_polygons, null, visited_portals, null);

  paint_visible_cells(visible_cells);
  draw_visible_polygons(visible_polygons);
}

function find_visible_regions(cell, visible_cells, visible_polygons, frustum_end_points, visited_portals, previous_cell){
  for(var i = 0, len = adj[cell].length; i < len; i++){
    var portal_key = parseInt(adj[cell][i]['key']), portal = portalsg.select("[key='" + portal_key + "']");
    var voronoi_edge_index = parseInt(portal.attr("voronoi_edge_index"));
    var neighbour = parseInt(adj[cell][i]['neighbour']);

    if((visited_portals[portal_key] == true) || (neighbour == previous_cell)){
      continue;
    }

    var x1 = parseFloat(portal.attr("x1")), y1 = parseFloat(portal.attr("y1")), x2 = parseFloat(portal.attr("x2")), y2 = parseFloat(portal.attr("y2"));
    var portal_segment = [[x1, y1], [x2, y2]];
    var next_frustum_end_points = portal_segment;


    if(cell == observer_cell){
      var trivial_visible_polygon = [observer_position, next_frustum_end_points[0], next_frustum_end_points[1]];
      visible_polygons.push(trivial_visible_polygon);

      visible_cells.add(neighbour);
      var visible_polygon = get_visible_polygon(neighbour, voronoi_edge_index, next_frustum_end_points);
      visible_polygons.push(visible_polygon);

      visited_portals[portal_key] = true;
      find_visible_regions(neighbour, visible_cells, visible_polygons, next_frustum_end_points, visited_portals, cell);
      visited_portals[portal_key] = false;
    }
    else{
      var voronoi_edge = linesg.select("[index='" + voronoi_edge_index + "']");
      var ve_x1 = parseFloat(voronoi_edge.attr("x1")), ve_y1 = parseFloat(voronoi_edge.attr("y1"));
      var ve_x2 = parseFloat(voronoi_edge.attr("x2")), ve_y2 = parseFloat(voronoi_edge.attr("y2"));
      var voronoi_edge_segment = [[ve_x1, ve_y1], [ve_x2, ve_y2]];

      next_frustum_end_points = get_frustum_intersection_points(frustum_end_points, voronoi_edge_segment, portal_segment);

      if(next_frustum_end_points.length == 2){ //equivalently next_frustum_end_points.length > 0
        visible_cells.add(neighbour);
        var visible_polygon = get_visible_polygon(neighbour, voronoi_edge_index, next_frustum_end_points);
        visible_polygons.push(visible_polygon);

        visited_portals[portal_key] = true;
        find_visible_regions(neighbour, visible_cells, visible_polygons, next_frustum_end_points, visited_portals, cell);
        visited_portals[portal_key] = false;
      }
    }
  }
}


function get_frustum_intersection_points(frustum_end_points, voronoi_edge_segment, portal_segment){
  var frustum_vector_1 = [frustum_end_points[0][0] - observer_position[0], frustum_end_points[0][1] - observer_position[1]];
  var frustum_vector_2 = [frustum_end_points[1][0] - observer_position[0], frustum_end_points[1][1] - observer_position[1]];
  var voronoi_edge_vector = [voronoi_edge_segment[1][0] - voronoi_edge_segment[0][0], voronoi_edge_segment[1][1] - voronoi_edge_segment[0][1]];

  var intersection_frustum_1 = _lines_intersection(voronoi_edge_segment[0], voronoi_edge_vector, observer_position, frustum_vector_1);
  var intersection_frustum_2 = _lines_intersection(voronoi_edge_segment[0], voronoi_edge_vector, observer_position, frustum_vector_2);

  var intersection_point_1 = intersection_frustum_1['point'], intersection_coefficient_1 = parseFloat(intersection_frustum_1['coefficient']);
  var intersection_point_2 = intersection_frustum_2['point'], intersection_coefficient_2 = parseFloat(intersection_frustum_2['coefficient']);

  if(intersection_point_1.length == 0 || intersection_point_2.length == 0){
    return []; //empty intersection
  }

  if(intersection_coefficient_1 < 0 && intersection_coefficient_2 < 0){
    return []; //empty intersection
  }
  else if(intersection_coefficient_1 < 0 || intersection_coefficient_2 < 0){
    var is_within_1 = within(intersection_point_1, intersection_point_2, voronoi_edge_segment[0]);
    var is_within_2 = within(intersection_point_1, intersection_point_2, voronoi_edge_segment[1]);

    var end_point;

    if(is_within_1 && is_within_2){
      return [];
    }
    else if(is_within_1){
      end_point = voronoi_edge_segment[1];
    }
    else{
      end_point = voronoi_edge_segment[0];
    }

    if(intersection_coefficient_1 < 0){
      intersection_point_1 = end_point;
    }
    else{
      intersection_point_2 = end_point;
    }
  }

  var line_segment = [intersection_point_1, intersection_point_2];
  var segments_intersection_points = equal_slope_segments_intersection(line_segment, portal_segment);

  return segments_intersection_points;
}


function get_visible_polygon(cell_index, portal_voronoi_edge_index, frustum_end_points){
  var frustum_vector_1 = [frustum_end_points[0][0] - observer_position[0], frustum_end_points[0][1] - observer_position[1]];
  var frustum_vector_2 = [frustum_end_points[1][0] - observer_position[0], frustum_end_points[1][1] - observer_position[1]];

  var diagram_cell = diagram.cells[cell_index];
  /*------------------------------------------------------------------------------------------
  Obtain the two intersection points of the frustum with the voronoi edges
  ------------------------------------------------------------------------------------------*/
  var intersection_point_frustum_1 = null, intersection_point_frustum_2 = null;

  for(var i = 0, len = diagram_cell.halfedges.length; i < len; i++){
    var voronoi_edge_index = diagram_cell.halfedges[i];

    // if(map_is_border_edge[voronoi_edge_index] || (voronoi_edge_index == portal_voronoi_edge_index)){
    if(voronoi_edge_index == portal_voronoi_edge_index){
      continue;
    }

    var voronoi_edge_segment = [diagram.edges[voronoi_edge_index][0], diagram.edges[voronoi_edge_index][1]];

    var intersection = line_segment_intersection(observer_position, frustum_vector_1, voronoi_edge_segment);
    var intersection_point = intersection['point'], is_different = intersection['equal'] == false;
    if(intersection_point.length > 0 && is_different){
      intersection_point_frustum_1 = {"point": intersection_point, "cell_half_edge_index": i};
    }
    intersection = line_segment_intersection(observer_position, frustum_vector_2, voronoi_edge_segment);
    intersection_point = intersection['point']; is_different = intersection['equal'] == false;
    if(intersection_point.length > 0 && is_different){
      intersection_point_frustum_2 = {"point": intersection_point, "cell_half_edge_index": i};
    }

    //We just found what we were looking for.
    if(intersection_point_frustum_1 != null && intersection_point_frustum_2 != null){
      break;
    }
  }

 //Plot intersection points test
 //  svg.append("circle")
 //     .attr("cx", intersection_point_frustum_1['point'][0])
 //     .attr("cy", intersection_point_frustum_1['point'][1])
 //     .attr("r", 2)
 //     .attr("class", "test");
 //
 // svg.append("circle")
 //    .attr("cx", intersection_point_frustum_2['point'][0])
 //    .attr("cy", intersection_point_frustum_2['point'][1])
 //    .attr("r", 2)
 //    .attr("class", "test");

  //It shouldn't happen. If so, there is something wrong...
  if(intersection_point_frustum_1 == null || intersection_point_frustum_2 == null){
    console.log("Error! Something is wrong.");
    return [];
  }
 /*------------------------------------------------------------------------------------------*/

 /*------------------------------------------------------------------------------------------
 Obtain the remaining polygon points
 ------------------------------------------------------------------------------------------*/
 var polygon_points = [];

 polygon_points.push(frustum_end_points[0]);
 polygon_points.push(intersection_point_frustum_1['point']);

 var start = parseInt(intersection_point_frustum_1['cell_half_edge_index']), end = parseInt(intersection_point_frustum_2['cell_half_edge_index']);
 var step = orient(frustum_end_points[0], intersection_point_frustum_1['point'], intersection_point_frustum_2['point']) < 0 ? 1 : -1;

 //console.log("start: " + start + " end: " + end + " step: " + step);

 if(start == end){
   polygon_points.push(intersection_point_frustum_2['point']);
   polygon_points.push(frustum_end_points[1]);
   return polygon_points;
 }

 var i = start;
 do {
   i = mod(i + step, diagram_cell.halfedges.length);

   var voronoi_edge_index = diagram_cell.halfedges[i];
   var voronoi_edge_segment = [diagram.edges[voronoi_edge_index][0], diagram.edges[voronoi_edge_index][1]];

   var p = frustum_end_points[0], q = voronoi_edge_segment[0], r = voronoi_edge_segment[1];

   if(orient(p, q, r) * step < 0){//Counter-clockwise orientation
     polygon_points.push(q);
   }
   else{
     polygon_points.push(r);
   }

 } while (i != end);

 var idx = polygon_points.length - 1;
 if((polygon_points[idx][0] != intersection_point_frustum_2['point'][0]) || (polygon_points[idx][1] != intersection_point_frustum_2['point'][1])){
   polygon_points.push(intersection_point_frustum_2['point']);
   polygon_points.push(frustum_end_points[1]);
 }

 return polygon_points;
}


function paint_visible_cells(visible_cells){
  polygonsg.selectAll("path")
           .classed("visible_cell", false);

  for(let cell of visible_cells){
    polygonsg.select("[index='" + cell + "']")
             .classed("visible_cell", true);
  }
}

function draw_visible_polygons(visible_polygons){
  visible_polygonsg.selectAll("path")
                   .remove();

  visible_polygonsg.selectAll("path")
                   .data(visible_polygons)
                   .enter()
                   .append("path")
                   .call(draw_polygon);
}
