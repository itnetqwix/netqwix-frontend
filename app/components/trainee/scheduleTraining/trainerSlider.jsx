import Slider from "react-slick";
import { Utils } from "../../../../utils/utils";
import Trainer from "./Trainer";

const TrainerSlider = ({
  list,
  isRecommended = false,
  setTrainerInfo,
  setSelectedTrainer,
  setParams,
  isOnlineFuncCall = false
}) => {
   
  const settings = {
    autoplay: false,
    infinite: false,
    speed: 400,
    slidesToShow: 3,
    slidesToScroll: 1,
    swipeToSlide: true,
    arrows: true,
    responsive: [
      {
        breakpoint: 1366,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 700,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };
  

  return (
    <div
      style={{ width: isRecommended ? "70%" : "80vw" }}
      className="recent-slider slider-container recent-chat"
    >
      <Slider {...settings}>
        {list.map((contentInfo, index) => {
          return (
            <div key={`slider-${contentInfo?._id}-${index}`} className="item">
              <Trainer
                trainer={contentInfo}
                onClickFunc={() => {
                  if(isOnlineFuncCall){
                  setTrainerInfo((prev) => ({
                    ...prev,
                    userInfo: contentInfo,
                    selected_category: null,
                  }));
                  setSelectedTrainer(contentInfo);
                  setParams({ search: contentInfo?.fullname });
                  }
                }}
              />
            </div>
          );
        })}
      </Slider>
      <br />
      <div />
    </div>
  );
};

export default TrainerSlider;
