(function( $ ) {
	var methods = {
		init: function( options ) {
			var $this = this;
			return this.each(function () {
				$this.settings = $.extend( {
					'timeout': 10
				}, options);
				$this.attr('timeout', $this.settings.timeout * 1000);
				$this.addClass('info');
			})
		},
		show: function() {},
		hide: function() {},
		update: function( message, type, time ) {
			var $this = this;
			return this.each(function () {
				if($this.hasClass('ui-state-error')) {
					$this.removeClass('ui-state-error');
				}
				if(type == 'update') {
					window.clearTimeout(window.infoTimer);
					window.infoTimer = setTimeout(function () {
						$this.addClass('ui-state-error');
					}, $this.attr('timeout'))
				}
				$this.effect('highlight');
				$this.html(message);
			});
		}
	}
	$.fn.info = function( method ) {		
		if ( methods[ method ] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.info' );
		}
	}
}) ( jQuery );
