class PerformanceController < ApplicationController
  def index

    text = params["input"] || "sauceyt"

    # if params["refresh"]
    #   redirect_to :perfomance_show_path, :json => text
    # end
  end

  def show
    
  end
end
