Teaspoon.defer = true;
setTimeout(Teaspoon.execute, 2000);

describe("Performance", function() {
  var syn;
  var synPart;
  var seq;
  var seq_two;
  var p;

  beforeEach(function() {
    syn  = new Synth('sine', "C-MAJ7");
    synPart = new Part(syn, "ONE_BAR_LOOP");
    seq = new Sequencer([synPart]);
    seq_two = new Sequencer([synPart]);
    p = new Performance(null, seq);
  });

  it("starts the initial sequencer automatically", function() {
    expect(seq.running()).toEqual(true);
  });

  describe('next_seq', function() {
    it("returns false from next_seq if there is no next sequence to play", function() {
      expect(p.nextSequence()).toEqual(false);
    });

    it("does nothing to the current sequence if there is no next sequence to play", function() {
      p.nextSequence();
      expect(seq.running()).toEqual(true);
    });

    it("returns true from next_seq if there is a next sequence to play", function() {
      p.enqueue(seq_two);
      expect(p.nextSequence()).toEqual(true);
    });

    it("stops the currently playing sequence and plays the next when the next_seq message is sent", function() {
      p.enqueue(seq_two);
      p.nextSequence();
      expect(seq.running()).toEqual(false);
    });

    it("inits and starts the next sequence when the next_seq message is sent", function() {
      p.enqueue(seq_two);
      p.nextSequence();
      expect(seq_two.running()).toEqual(true);
    });
  });

  describe('change', function() {
    it('returns false if there is no index passed', function() {
      expect(p.change()).toBe(false);
    });

    it('returns false if the given index does not exist', function() {
      expect(p.change(1)).toBe(false);
    });

    it('returns false if the given index does is invalid', function() {
      expect(p.change(-1)).toBe(false);
    });

    it('returns true if the given index does is valid', function() {
      p.enqueue(seq_two);
      expect(p.change(1)).toBe(true);
    });

    it('stops the currently playing sequence', function() {
      p.enqueue(seq_two);
      p.change(1)
      expect(seq.running()).toBe(false);
    });

    it('starts the sequence at the index specified', function() {
      p.enqueue(seq_two);
      p.change(1)
      expect(seq_two.running()).toBe(true);
    });
  });

  describe('enqueue', function() {
    it('returns the index of the enqueued sequence', function() {
      expect(p.enqueue(seq_two)).toEqual(1);
    });
  });

  describe('stop', function() {
    it('stops the currently playing sequence', function() {
      p.stop();
      expect(seq.running()).toBe(false);
    });
  });
});
