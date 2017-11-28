// Do all the things
$(function() {

	// Handler for socket broadcasts
	$("#testChannelSocket").submit((e) => {
		e.preventDefault();

		$.post('testChannelSocket', {
			channelID: $("#testChannelID").val(),
			message: $("#testChannelMessage").val()
		});
	});

	// Handler for socket whispers
	$("#testUserSocket").submit((e) => {
		e.preventDefault();

		$.post('testUserSocket', {
			socketID: $("#testSocketID").val(),
			message: $("#testSocketMessage").val()
		});
	});

	// Handler for PubSub broadcasts
	$("#testPubsubBroadcast").submit((e) => {
		e.preventDefault();

		$.post('testPubsubBroadcast', {
			channelID: $("#testPubsubChannelID").val(),
			message: $("#testBroadcastMessage").val()
		});
	});

	// Handler for PubSub whispers
	$("#testPubsubWhisper").submit((e) => {
		e.preventDefault();

		$.post('testPubsubWhisper', {
			channelID: $("#testWhisperChannelID").val(),
			opaqueID: $("#testOpaqueID").val(),
			message: $("#testWhisperMessage").val()
		});
	});


});