var fbBaseURL = "https://blistering-fire-3878.firebaseio.com/";

var GamesLobbyView = Backbone.View.extend({
  el: $('#gameLobbyBackbone'),
  template: Templates['public/templates/gameLobby.hbs'],
  events: {
    "click .js-create-game": "createGame"
  },

  initialize: function() {
    this.listenTo(this.collection, "add remove", this.render);
  },

  render: function() {
    this.$el.empty();
    this.$el.html(this.template());
    for (var i = 0; i < this.collection.length; i++) {
      var gameModel = this.collection.models[i];
      var gameLabelView = new GameLabelView({model:gameModel});
      $('.js-games-list').append(gameLabelView.render().el);
    }
    this.$el.append(Templates['public/templates/testTemplate.hbs']);
    return this;
  },

  createGame: function() {
    var gameInfo = {
      name: $('.js-game-name').val(),
      size: 9,
      moveCount: 1
    };
    var newGame = new GameModel(gameInfo);
    this.collection.add(newGame);
  }
});

var GameLabelView = Backbone.View.extend({
  tagName: "a",
  className: "list-group-item games-list-item",
  template: Templates['public/templates/gameLabelTitle.hbs'],
  events: {
    "click": "openGame"
  },
  initialize: function() {
    this.listenTo(this.model, 'change', this.render);
  },
  render: function() {
    this.$el.html(this.template(this.model.forTemplate()));
    return this;
  },
  openGame: function() {
    var openedGame = new OpenGameView({model: this.model});
    $('#gameLobbyBackbone').hide();
    $('#openGameBackbone').empty().html(openedGame.render().el);
  }
});

var OpenGameView = Backbone.View.extend({
  events: {
    "click .js-return-to-lobby": "returnToLobby",
    "click .js-play-as-black": "playAsBlack",
    "click .js-play-as-white": "playAsWhite"
  },
  template: Templates['public/templates/openGame.hbs'],
  initialize: function() {
    this.listenTo(this.model, 'change', this.render);
    var gameRef = new Firebase(fbBaseURL + '/games/' + this.model.attributes.id);
    var myName = "Anonymous User";
    var attr = {
      parent: this
    };
    this.boardView = new BoardView({model: this.model, attributes: attr});
    var spectatorsRef = gameRef.child('spectators');
    this.mySpectatorEntryRef = spectatorsRef.push({name: myName});
    this.mySpectatorID = this.mySpectatorEntryRef.name();
    this.mySpectatorEntryRef.onDisconnect().remove();
    this.playerColor = 'spectator';

  },
  render: function() {
    var modelObj = this.model.forTemplate();
    modelObj = _.extend(modelObj, {
      black: this.playerColor == 'black',
      white: this.playerColor == 'white',
      spectator: this.playerColor =='spectator',
      blackScore: this.boardView.scores.black,
      whiteScore: this.boardView.scores.white
    });
    this.$el.html(this.template(modelObj));
    this.$('.js-board').html(this.boardView.render().el);
    this.boardView.delegateEvents();
    return this;
  },

  returnToLobby: function() {
    $('#gameLobbyBackbone').show();
    if(this.playerColor == 'black' || this.playerColor == 'white'){
      this.playerRef.remove();
    }
    this.mySpectatorEntryRef.remove();
    this.remove();
  },
  playAsBlack: function() {
    this.playAsColor('black');
  },
  playAsWhite: function() {
    this.playAsColor('white');
  },
  playAsColor: function(color) {
    this.playerColor = color;
    var nameString = "a Player's Name";
    var gameID = this.model.attributes.id;
    this.playerRef = new Firebase(fbBaseURL + '/games/' + gameID + "/" + color + "Player");
    // TODO: Change this to a transaction
    this.playerRef.set({name: nameString, id: this.mySpectatorID});
    this.playerRef.onDisconnect().remove();
    this.boardView.applyPotentialMoveCSS();
  }
});

var BoardView = Backbone.View.extend({
  events: {
    "click": "makeAMove"
  },
  initialize: function() {
    // Initialize the board intersections
    var size = this.model.attributes.size;
    this.scores = {
      white: 0,
      black: 0
    };
    this.boardIntersections = {};
    for (var row = size; row > 0; row--) {
      var rowObj = {};
      // var rowStr = 'r' + row;
      this.boardIntersections[row] = rowObj;
      for (var col = size; col > 0; col--) {
        // var colID = 'c' + col;
        var attr = {
          parent: this,
          row: row,
          col: col
        };
        var boardIntersection = new BoardIntersectionView({attributes:attr});
        rowObj[col] = boardIntersection;
      }
    }
    // Create a new firebase collection for moves of this game
    var gameID = this.model.attributes.id;
    var movesRef = fbBaseURL + 'games/' + gameID + '/moves';

    var movesListRef = new Firebase(movesRef);
    var boundRenderMoves = this.renderMove.bind(this);
    movesListRef.on('child_added', boundRenderMoves);
    this.$el.append(this.constructBoardEl());
  },
  render: function() {
    this.delegateIntersectionViewEvents();
    this.applyPotentialMoveCSS();
    this.applyBoardCSS();
    return this;
  },
  constructBoardEl: function() {
    var size = this.model.attributes.size;

    // Render board grid numbers
    $topRuler = $("<div class='board-ruler ruler-top'></div>");
    this.$el.append($topRuler);
    for (r = 0; r < size; r++){
      var alpha = String.fromCharCode('A'.charCodeAt(0) + r);
      var num = r + 1;
      var markerHTML = Mustache.render("<div class='ruler-marker'>{{marker}}</div>", {marker: num});
      $marker = $(markerHTML);
      $marker.appendTo($topRuler);
    }

    $leftRuler = $("<div class='board-ruler ruler-vertical'></div>");
    this.$el.append($leftRuler);
    for (r = size; r > 0; r--){
      var verticalMarkerHTML = Mustache.render("<div class='ruler-marker'>{{marker}}</div>", {marker: r});
      $marker = $(verticalMarkerHTML);
      $marker.appendTo($leftRuler);
    }

    // Render the board grid
    for (r = 0; r < size - 1; r++) {
      $gridRow = $("<div class='grid-row'></div>");
      this.$el.append($gridRow);
      for (c = 0; c < size - 1; c++) {
        $gridSquare = $("<div class='grid-square'></div>");
        $gridSquare.appendTo($gridRow);
      }
    }
    // Render board
    for (var row = size; row > 0; row--) {
      var $row = $("<div class='stone-row'></div>");
      this.$el.append($row);
      for (var col = 1; col <= size; col++) {
        var colID = 'c' + col;
        var boardIntersection = this.getBoardIntersectionView(row, col);
        $row.append(boardIntersection.render().el);
        boardIntersection.delegateEvents();
      }
    }

  },
  applyBoardCSS: function() {

  },
  renderMove: function(snapshot) {
    var moveObj = snapshot.val();
    var boardIntersectionView = this.getBoardIntersectionView(moveObj.row, moveObj.col);
    function moveColor (moveNumber){
      if (moveNumber % 2 === 0) {return 'white';} else{return 'black';}
    }
    this.currMoveColor = moveColor(moveObj.move);
    boardIntersectionView.displayColor(this.currMoveColor);
    var boardState = this.getBoardObject();
    var moveCoord = {
      x: moveObj.col,
      y: moveObj.row,
      color: moveObj.color
    };
    var newDeadStones = deadStones(boardState, moveCoord);
    for (var i = newDeadStones.length - 1; i >= 0; i--) {
      this.getBoardIntersectionView(newDeadStones[i].y, newDeadStones[i].x).clearIntersection();
    }
    this.applyPotentialMoveCSS();
    // Update score
    this.scores[this.currMoveColor] += newDeadStones.length;
  },
  getBoardIntersectionView: function(row, col) {
    // var rowID = 'r' + row.toString();
    // var colID = 'c' + col.toString();
    return this.boardIntersections[row][col];
  },
  boardIntersectionViews: function() {
    return _.flatten(_.map(_.values(this.boardIntersections), function(obj){return _.values(obj);}));
  },
  delegateIntersectionViewEvents: function() {
    var intersections = this.boardIntersectionViews();
    for (var i = intersections.length - 1; i >= 0; i--) {
      intersections[i].delegateEvents();
    }
  },
  makeMove: function(boardIntersectionView) {
    if(this.isValidMove(boardIntersectionView)) {
      var gameMovesRef = new Firebase(fbBaseURL + '/games/' + this.model.attributes.id + "/moves/");
      var row = boardIntersectionView.attributes.row;
      var col = boardIntersectionView.attributes.col;
      gameMovesRef.push({
        row:row,
        col:col,
        move:this.model.forTemplate().totalMoves,
        color:this.attributes.parent.playerColor
      });
    }
    else {
      console.log('invalid move');
    }
  },
  // Expensive, checks entire board, be careful
  isValidMove: function(intersectionView) {
    if(intersectionView.state == 'black' || intersectionView.state == 'white') {
      return false;
    }
    var currentPlayerColor = this.attributes.parent.playerColor;

    if(currentPlayerColor != this.model.forTemplate().currentTurnColor){
      return false;
    }
    return true;
  },
  applyPotentialMoveCSS: function() {
    var currentPlayerColor = this.attributes.parent.playerColor;

    var validMoves = getValidMoves(this.getBoardObject(), currentPlayerColor);
    var intersections = this.boardIntersectionViews();
    var nextMoveColor = oppositeColor(this.currMoveColor);
    for (var i = intersections.length - 1; i >= 0; i--) {
      intersections[i].$el.removeClass('black-hover white-hover');
      var intersectX = intersections[i].attributes.col;
      var intersectY = intersections[i].attributes.row;
      if(nextMoveColor == currentPlayerColor && validMoves[intersectX][intersectY]) {
        var className = this.attributes.parent.playerColor + "-hover";
        intersections[i].$el.addClass(className);
      }
    }
  },

  getBoardObject: function() {
    var boardSize = this.model.attributes.size;
    var board = {};
    for (var row = 1; row <= boardSize; row++) {
      var aRow = {};
      board[row] = aRow;
    }
    var intersections = this.boardIntersectionViews();
    for (var i = intersections.length - 1; i >= 0; i--) {
      var x = intersections[i].attributes.col;
      var y = intersections[i].attributes.row;
      board[x][y] = intersections[i].state;
    }
    return board;
  }
});

var BoardIntersectionView = Backbone.View.extend({
  className: "stone-col",
  events: {
    "click": "makeMove"
  },
  initialize: function() {
    this.state = 'empty';
  },
  render: function() {
    return this;
  },
  clearIntersection: function() {
    this.state = 'empty';
    this.$el.removeClass('black-move white-move');
  },
  displayColor: function(color) {
    var className = color + '-move';
    this.state = color;
    this.$el.addClass(className);
  },
  makeMove: function(){
    this.attributes.parent.makeMove(this);
  }
});