(function () {

  var EffectFactory = {
    createEffect: function(effectType){
      switch(effectType){
        case 'reverb' :
          return new Reverb();
        case 'distortion' :
          return new Distortion();
      }
    }
  }

  window.EffectFactory = EffectFactory;
}).call(this);


